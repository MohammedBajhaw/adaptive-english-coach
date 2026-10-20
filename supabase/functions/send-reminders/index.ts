// Supabase Edge Function: sends phone reminders (Web Push) that follow the learner's wake cycle:
//   - every N hours (default 2) during the cycle: the words that are due and not easy;
//   - once per cycle, some hours after waking: the daily plan, if tasks are left;
//   - when the cycle's hours are over: one "did you wake up?" prompt, then silence until a new cycle starts.
// A cron job calls it every 10 minutes (see PHONE_REMINDERS.md). It has no dependencies: Web Push encryption
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
  cycle_started_at: string | null;
  cycle_hours: number;
  cycle_date_key: string | null;
  wake_prompt_sent_at: string | null;
  vocab_reminder_enabled: boolean;
  vocab_reminder_every_hours: number;
  reminder_enabled: boolean;            // the daily-plan reminder
  daily_reminder_after_hours: number;
  last_vocab_push_at: string | null;
  last_daily_push_date: string | null;  // the cycle date key that already got its daily-plan reminder
};

export type ReminderKind = "wake" | "daily" | "vocab";

const HOUR = 3_600_000;

// One decision per run, in priority order: wake prompt, daily plan, vocabulary tick.
// Reminders exist only inside the cycle: they are counted from the cycle's start, and at the end only the wake prompt is sent.
export function decideCycleReminder(input: { now: Date; prefs: ReminderPrefs; dueNonEasy: number; pendingTasks: number }): ReminderKind | null {
  const { now, prefs } = input;
  if (!prefs.cycle_started_at) return null;
  const start = Date.parse(prefs.cycle_started_at);
  const elapsed = now.getTime() - start;
  if (elapsed < 0) return null; // the cycle has not begun yet

  if (elapsed >= prefs.cycle_hours * HOUR) {
    const promptedThisCycle = prefs.wake_prompt_sent_at !== null && Date.parse(prefs.wake_prompt_sent_at) >= start;
    return promptedThisCycle ? null : "wake";
  }

  const dailyDue = prefs.reminder_enabled
    && elapsed >= prefs.daily_reminder_after_hours * HOUR
    && prefs.last_daily_push_date !== prefs.cycle_date_key
    && input.pendingTasks > 0;
  if (dailyDue) return "daily";

  if (!prefs.vocab_reminder_enabled || input.dueNonEasy <= 0) return null;
  const every = Math.max(1, prefs.vocab_reminder_every_hours) * HOUR;
  const tick = Math.floor(elapsed / every);
  if (tick < 1) return null;
  // The latest scheduled tick sends once; if the cron job was late, older ticks are not replayed.
  const tickTime = start + tick * every;
  const lastPush = prefs.last_vocab_push_at ? Date.parse(prefs.last_vocab_push_at) : 0;
  return lastPush < tickTime ? "vocab" : null;
}

export type DueCounts = { again: number; hard: number; good: number; fresh: number };

export function vocabMessage(counts: DueCounts) {
  const total = counts.again + counts.hard + counts.good + counts.fresh;
  const parts = [
    counts.again > 0 ? `${counts.again} لم أتذكرها` : null,
    counts.hard > 0 ? `${counts.hard} صعبة` : null,
    counts.good > 0 ? `${counts.good} للنطق والإملاء` : null,
    counts.fresh > 0 ? `${counts.fresh} جديدة` : null,
  ].filter(Boolean);
  return { title: "راجع كلماتك", body: `عندك ${total} كلمة تنتظر المراجعة: ${parts.join("، ")}.`, url: "cards", tag: "vocab-review" };
}

export function dailyMessage(pendingTasks: number) {
  return { title: "وقت دراستك اليوم", body: `بقي ${pendingTasks} من مهام خطة اليوم. ابدأ بخطوة قصيرة الآن.`, url: "", tag: "daily-plan" };
}

export function wakeMessage(cycleHours: number) {
  return {
    title: "هل استيقظت؟",
    body: `انتهت دورتك (${cycleHours} ساعة). اضغط عندما تستيقظ لتبدأ دورة جديدة.`,
    url: "wake",
    tag: "wake",
    actions: [{ action: "wake", title: "استيقظت" }],
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
  const profiles: Array<ReminderPrefs & { user_id: string }> = await rest("learner_profiles?select=user_id,cycle_started_at,cycle_hours,cycle_date_key,wake_prompt_sent_at,vocab_reminder_enabled,vocab_reminder_every_hours,reminder_enabled,daily_reminder_after_hours,last_vocab_push_at,last_daily_push_date&cycle_started_at=not.is.null&or=(reminder_enabled.eq.true,vocab_reminder_enabled.eq.true)");
  if (!profiles.length) return json({ users: 0, sent: 0 });

  const ids = profiles.map(profile => profile.user_id).join(",");
  const subscriptions: Subscription[] = await rest(`push_subscriptions?select=id,user_id,endpoint,p256dh,auth&user_id=in.(${ids})`);
  const byUser = new Map<string, Subscription[]>();
  for (const subscription of subscriptions) byUser.set(subscription.user_id, [...(byUser.get(subscription.user_id) ?? []), subscription]);
  const withDevices = profiles.filter(profile => byUser.has(profile.user_id));
  if (!withDevices.length) return json({ users: 0, sent: 0 });

  const deviceIds = withDevices.map(profile => profile.user_id).join(",");
  const dateKeys = [...new Set(withDevices.map(profile => profile.cycle_date_key).filter(Boolean))].join(",");
  const tasks: Array<{ user_id: string; date_key: string; status: string }> = dateKeys
    ? await rest(`daily_tasks?select=user_id,date_key,status&date_key=in.(${dateKeys})&user_id=in.(${deviceIds})`)
    : [];
  // Due words that are not easy; cards from the retired word list are excluded.
  const dueRows: Array<{ user_id: string; last_rating: string | null; review_count: number }> = await rest(`vocabulary_cards?select=user_id,last_rating,review_count&next_review_at=lte.${now.toISOString()}&user_id=in.(${deviceIds})&content_id=not.like.vocabulary.*&or=(last_rating.is.null,last_rating.neq.easy)`);

  let sent = 0, removed = 0, failed = 0;
  for (const profile of withDevices) {
    const completed = tasks.filter(task => task.user_id === profile.user_id && task.date_key === profile.cycle_date_key && task.status === "completed").length;
    const pendingTasks = 5 - completed;
    const mine = dueRows.filter(row => row.user_id === profile.user_id);
    const counts: DueCounts = {
      again: mine.filter(row => row.last_rating === "again").length,
      hard: mine.filter(row => row.last_rating === "hard").length,
      good: mine.filter(row => row.last_rating === "good").length,
      fresh: mine.filter(row => row.last_rating === null).length,
    };
    const kind = decideCycleReminder({ now, prefs: profile, dueNonEasy: mine.length, pendingTasks });
    if (!kind) continue;

    const message = kind === "wake" ? wakeMessage(profile.cycle_hours) : kind === "daily" ? dailyMessage(pendingTasks) : vocabMessage(counts);
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
      const stamp = now.toISOString();
      const patch = kind === "wake" ? { wake_prompt_sent_at: stamp }
        : kind === "daily" ? { last_daily_push_date: profile.cycle_date_key, last_vocab_push_at: stamp }
        : { last_vocab_push_at: stamp };
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
