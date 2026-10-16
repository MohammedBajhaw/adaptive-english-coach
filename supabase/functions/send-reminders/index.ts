// Supabase Edge Function: sends phone reminders (Web Push) for vocabulary review and the daily plan.
// A cron job calls it every 30 minutes (see docs in README). It has no dependencies: Web Push encryption
// (RFC 8291 / RFC 8188) and VAPID signing (RFC 8292) use the built-in WebCrypto API.
//
// Deploy with "Verify JWT" turned OFF (the caller is the cron job, protected by the x-cron-secret header).
// Secrets: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase).

const encoder = new TextEncoder();

// ---------------------------------------------------------------- bytes helpers
export function b64urlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export function bytesToB64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrays: Uint8Array[]) {
  const out = new Uint8Array(arrays.reduce((total, array) => total + array.length, 0));
  let offset = 0;
  for (const array of arrays) { out.set(array, offset); offset += array.length; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

// ------------------------------------------------------------------- Web Push
// Encrypts a payload for one subscription (aes128gcm content coding, a single record).
export async function encryptPayload(plaintext: Uint8Array, userPublicKey: string, authSecretB64: string) {
  const uaPublic = b64urlToBytes(userPublicKey);
  const authSecret = b64urlToBytes(authSecretB64);
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, ephemeral.privateKey, 256));

  const keyInfo = concat(encoder.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const record = concat(plaintext, new Uint8Array([2])); // 0x02 marks the last record
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, record));

  const recordSize = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, recordSize, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

// Builds the VAPID Authorization header for a push endpoint.
export async function vapidAuthorization(endpoint: string, publicKey: string, privateKey: string, subject: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const publicBytes = b64urlToBytes(publicKey);
  const jwk = { kty: "EC", crv: "P-256", x: bytesToB64url(publicBytes.slice(1, 33)), y: bytesToB64url(publicBytes.slice(33, 65)), d: privateKey, ext: true };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = bytesToB64url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToB64url(encoder.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 3600, sub: subject })));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${bytesToB64url(signature)}, k=${publicKey}`;
}

type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

async function sendPush(subscription: Subscription, payload: object, vapid: { publicKey: string; privateKey: string; subject: string }) {
  const body = await encryptPayload(encoder.encode(JSON.stringify(payload)), subscription.p256dh, subscription.auth);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600",
      Urgency: "normal",
    },
    body,
  });
  return response.status;
}

// ----------------------------------------------------------------- scheduling
export type ReminderPrefs = {
  timezone: string;
  reminder_enabled: boolean;
  reminder_hour_local: number;
  vocab_reminder_enabled: boolean;
  vocab_reminder_every_hours: number;
  reminder_window_start: number;
  reminder_window_end: number;
  last_vocab_push_at: string | null;
  last_daily_push_date: string | null;
};

// Local hour (0-23) and local calendar date (YYYY-MM-DD) in the learner's time zone.
export function localParts(now: Date, timeZone: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit" }).formatToParts(now);
  }
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return { hour: Number(get("hour")) % 24, dateKey: `${get("year")}-${get("month")}-${get("day")}` };
}

const TOLERANCE_MS = 10 * 60 * 1000; // the cron job runs every 30 minutes, so allow some drift

export function decideReminders(input: { now: Date; prefs: ReminderPrefs; vocabularyDone: boolean; pendingTasks: number }) {
  const { now, prefs } = input;
  const local = localParts(now, prefs.timezone);
  const daily = prefs.reminder_enabled
    && local.hour === prefs.reminder_hour_local
    && prefs.last_daily_push_date !== local.dateKey
    && input.pendingTasks > 0;
  const lastVocab = prefs.last_vocab_push_at ? new Date(prefs.last_vocab_push_at).getTime() : 0;
  const spacedEnough = now.getTime() - lastVocab >= prefs.vocab_reminder_every_hours * 3_600_000 - TOLERANCE_MS;
  const inWindow = local.hour >= prefs.reminder_window_start && local.hour < prefs.reminder_window_end;
  // One notification per run: the daily-plan reminder wins over the vocabulary one.
  const vocab = prefs.vocab_reminder_enabled && inWindow && spacedEnough && !input.vocabularyDone && !daily;
  return { daily, vocab, localDateKey: local.dateKey };
}

export function dailyMessage(pendingTasks: number) {
  return { title: "وقت دراستك اليوم", body: `بقي ${pendingTasks} من مهام خطة اليوم. ابدأ بخطوة قصيرة الآن.`, url: "", tag: "daily-plan" };
}

export function vocabMessage(dueCards: number) {
  return {
    title: "راجع مفرداتك",
    body: dueCards > 0 ? `عندك ${dueCards} بطاقة تنتظر المراجعة. دقيقتان تكفي.` : "كلمات اليوم الجديدة جاهزة. افتح البطاقات وراجعها.",
    url: "cards",
    tag: "vocab-review",
  };
}

// -------------------------------------------------------------------- handler
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function handler(request: Request) {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || request.headers.get("x-cron-secret") !== cronSecret) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapid = { publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? "", privateKey: Deno.env.get("VAPID_PRIVATE_KEY") ?? "", subject: Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com" };
  if (!supabaseUrl || !serviceKey || !vapid.publicKey || !vapid.privateKey) return json({ error: "missing configuration" }, 500);

  const rest = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...init, headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json", ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error(`${path.split("?")[0]} ${response.status}: ${(await response.text()).slice(0, 200)}`);
    return init.method === "PATCH" || init.method === "DELETE" ? null : await response.json();
  };

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10); // daily_tasks.date_key is the UTC date
  const profiles: Array<ReminderPrefs & { user_id: string }> = await rest("learner_profiles?select=user_id,timezone,reminder_enabled,reminder_hour_local,vocab_reminder_enabled,vocab_reminder_every_hours,reminder_window_start,reminder_window_end,last_vocab_push_at,last_daily_push_date&or=(reminder_enabled.eq.true,vocab_reminder_enabled.eq.true)");
  if (!profiles.length) return json({ users: 0, sent: 0 });

  const ids = profiles.map(profile => profile.user_id).join(",");
  const subscriptions: Subscription[] = await rest(`push_subscriptions?select=id,user_id,endpoint,p256dh,auth&user_id=in.(${ids})`);
  const byUser = new Map<string, Subscription[]>();
  for (const subscription of subscriptions) byUser.set(subscription.user_id, [...(byUser.get(subscription.user_id) ?? []), subscription]);
  const withDevices = profiles.filter(profile => byUser.has(profile.user_id));
  if (!withDevices.length) return json({ users: 0, sent: 0 });

  const deviceIds = withDevices.map(profile => profile.user_id).join(",");
  const tasks: Array<{ user_id: string; task_key: string; status: string }> = await rest(`daily_tasks?select=user_id,task_key,status&date_key=eq.${todayKey}&user_id=in.(${deviceIds})`);
  const dueRows: Array<{ user_id: string }> = await rest(`vocabulary_cards?select=user_id&next_review_at=lte.${now.toISOString()}&user_id=in.(${deviceIds})`);

  let sent = 0, removed = 0, failed = 0;
  for (const profile of withDevices) {
    const mine = tasks.filter(task => task.user_id === profile.user_id);
    const completed = mine.filter(task => task.status === "completed");
    // Tasks are created when the dashboard opens; a missing row means the day has not started.
    const pendingTasks = 5 - completed.length;
    const vocabularyDone = completed.some(task => task.task_key === "vocabulary");
    const decision = decideReminders({ now, prefs: profile, vocabularyDone, pendingTasks });
    if (!decision.daily && !decision.vocab) continue;

    const message = decision.daily ? dailyMessage(pendingTasks) : vocabMessage(dueRows.filter(row => row.user_id === profile.user_id).length);
    let delivered = false;
    for (const subscription of byUser.get(profile.user_id) ?? []) {
      try {
        const status = await sendPush(subscription, message, vapid);
        if (status >= 200 && status < 300) { delivered = true; sent += 1; }
        else if (status === 404 || status === 410) { await rest(`push_subscriptions?id=eq.${subscription.id}`, { method: "DELETE" }); removed += 1; }
        else { failed += 1; console.error(`push failed ${status} for ${subscription.endpoint.slice(0, 60)}`); }
      } catch (error) {
        failed += 1;
        console.error("push error", error instanceof Error ? error.message : error);
      }
    }
    if (delivered) {
      const patch = decision.daily ? { last_daily_push_date: decision.localDateKey, last_vocab_push_at: now.toISOString() } : { last_vocab_push_at: now.toISOString() };
      await rest(`learner_profiles?user_id=eq.${profile.user_id}`, { method: "PATCH", body: JSON.stringify(patch) });
    }
  }
  return json({ users: withDevices.length, sent, removed, failed });
}

// Only inside the Supabase runtime (the tests import this file in Node, where Deno does not exist).
if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
  Deno.serve(async request => {
    try { return await handler(request); } catch (error) {
      console.error("send-reminders failed", error instanceof Error ? error.message : error);
      return json({ error: "internal error" }, 500);
    }
  });
}
