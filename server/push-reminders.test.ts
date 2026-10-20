import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  b64urlToBytes,
  bytesToB64url,
  dailyMessage,
  decideCycleReminder,
  encryptPayload,
  vapidAuthorization,
  vocabMessage,
  wakeMessage,
  type ReminderPrefs,
} from "../supabase/functions/send-reminders/index";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

// What a phone's push service client does with an incoming message (RFC 8291 section 3.4).
async function decryptAsBrowser(body: Uint8Array, receiver: CryptoKeyPair, authSecret: Uint8Array) {
  const salt = body.slice(0, 16);
  const idLength = body[20]!;
  const asPublic = body.slice(21, 21 + idLength);
  const ciphertext = body.slice(21 + idLength);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey("raw", receiver.publicKey));
  const senderKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: senderKey }, receiver.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(encoder.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const contentKey = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["decrypt"]);
  const record = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aesKey, ciphertext));
  expect(record[record.length - 1]).toBe(2);
  return record.slice(0, -1);
}

describe("Web Push encryption", () => {
  it("يفك المتصفح الرسالة المشفرة ويحصل على النص الأصلي بالعربية", async () => {
    const receiver = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const authSecret = crypto.getRandomValues(new Uint8Array(16));
    const publicKey = bytesToB64url(new Uint8Array(await crypto.subtle.exportKey("raw", receiver.publicKey)));
    const message = JSON.stringify({ title: "راجع مفرداتك", body: "عندك 5 بطاقة تنتظر المراجعة.", url: "cards" });
    const body = await encryptPayload(encoder.encode(message), publicKey, bytesToB64url(authSecret));
    expect(body[16]).toBe(0); expect(body[17]).toBe(0); expect(body[18]).toBe(16); expect(body[19]).toBe(0);
    expect(body[20]).toBe(65);
    expect(decoder.decode(await decryptAsBrowser(body, receiver, authSecret))).toBe(message);
  });

  it("يختلف الناتج في كل إرسال لنفس الرسالة", async () => {
    const receiver = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const publicKey = bytesToB64url(new Uint8Array(await crypto.subtle.exportKey("raw", receiver.publicKey)));
    const auth = bytesToB64url(crypto.getRandomValues(new Uint8Array(16)));
    const first = await encryptPayload(encoder.encode("same"), publicKey, auth);
    const second = await encryptPayload(encoder.encode("same"), publicKey, auth);
    expect(bytesToB64url(first)).not.toBe(bytesToB64url(second));
  });
});

describe("VAPID", () => {
  it("يوقّع الرمز بمفتاح الخادم ويمكن التحقق منه بالمفتاح العام", async () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = privateKey.export({ format: "jwk" });
    const publicBytes = concat(new Uint8Array([4]), b64urlToBytes(jwk.x!), b64urlToBytes(jwk.y!));
    const publicKey = bytesToB64url(publicBytes);
    const header = await vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", publicKey, jwk.d!, "mailto:test@example.com", 1_800_000_000);
    const match = header.match(/^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/);
    expect(match).not.toBeNull();
    const [, head, claims, signature, k] = match!;
    expect(k).toBe(publicKey);
    expect(JSON.parse(decoder.decode(b64urlToBytes(head!)))).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(decoder.decode(b64urlToBytes(claims!)))).toEqual({ aud: "https://fcm.googleapis.com", exp: 1_800_000_000 + 12 * 3600, sub: "mailto:test@example.com" });
    const verifyKey = await crypto.subtle.importKey("raw", publicBytes, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, verifyKey, b64urlToBytes(signature!), encoder.encode(`${head}.${claims}`));
    expect(valid).toBe(true);
  });
});

// The learner's example: the cycle starts at 04:00 and lasts 18 hours, with a reminder every two hours.
const START = "2026-10-20T04:00:00Z";
const at = (hoursAfterStart: number, minutes = 0) => new Date(Date.parse(START) + hoursAfterStart * 3_600_000 + minutes * 60_000);

const prefs: ReminderPrefs = {
  cycle_started_at: START,
  cycle_hours: 18,
  cycle_date_key: "2026-10-20",
  wake_prompt_sent_at: null,
  vocab_reminder_enabled: true,
  vocab_reminder_every_hours: 2,
  reminder_enabled: true,
  daily_reminder_after_hours: 8,
  last_vocab_push_at: null,
  last_daily_push_date: null,
};
const base = { dueNonEasy: 5, pendingTasks: 5 };
const decide = (now: Date, overrides: Partial<ReminderPrefs> = {}, extra: Partial<typeof base> = {}) =>
  decideCycleReminder({ now, prefs: { ...prefs, ...overrides }, ...base, ...extra });

describe("vocabulary reminders every two hours", () => {
  it("لا يرسل شيئًا قبل أن تبدأ الدورة ولا في أول ساعتين", () => {
    expect(decide(new Date(Date.parse(START) - 60_000))).toBeNull();
    expect(decide(at(0))).toBeNull();
    expect(decide(at(1, 59))).toBeNull();
  });

  it("أول تذكير بعد ساعتين من البداية، والثاني بعد أربع", () => {
    expect(decide(at(2))).toBe("vocab");
    expect(decide(at(2, 5), { last_vocab_push_at: at(2).toISOString() })).toBeNull();
    expect(decide(at(4), { last_vocab_push_at: at(2).toISOString() })).toBe("vocab");
  });

  it("لا يكرر العلامة نفسها لكن لا يعيد العلامات الفائتة عند تأخر الجدولة", () => {
    // the cron job was down from +2h to +6h20: only one catch-up reminder, for the latest tick (+6h)
    expect(decide(at(6, 20), { last_vocab_push_at: at(2, 1).toISOString() })).toBe("vocab");
    expect(decide(at(6, 30), { last_vocab_push_at: at(6, 20).toISOString() })).toBeNull();
  });

  it("يصل ثماني تذكيرات في دورة 18 ساعة (عند 2 و4 و... و16)", () => {
    let last: string | null = null;
    let sent = 0;
    for (let minute = 0; minute <= 18 * 60 - 1; minute += 10) {
      const now = at(0, minute);
      if (decide(now, { last_vocab_push_at: last, reminder_enabled: false }) === "vocab") { sent += 1; last = now.toISOString(); }
    }
    expect(sent).toBe(8);
  });

  it("لا يرسل إذا لم تكن هناك كلمات مستحقة غير سهلة", () => {
    expect(decide(at(2), {}, { dueNonEasy: 0 })).toBeNull();
  });

  it("يحترم إيقاف تذكير الكلمات والفاصل المختار", () => {
    expect(decide(at(2), { vocab_reminder_enabled: false })).toBeNull();
    expect(decide(at(2), { vocab_reminder_every_hours: 3 })).toBeNull();
    expect(decide(at(3), { vocab_reminder_every_hours: 3 })).toBe("vocab");
  });
});

describe("end of the cycle: the wake-up prompt", () => {
  it("بعد 18 ساعة بالضبط تُرسل رسالة «هل استيقظت؟» ولا يُرسل تذكير كلمات", () => {
    expect(decide(at(17, 59), { reminder_enabled: false })).toBe("vocab");
    expect(decide(at(18))).toBe("wake");
    expect(decide(at(18), { last_vocab_push_at: at(16).toISOString() })).toBe("wake");
  });

  it("تُرسل مرة واحدة ثم صمت تام حتى تبدأ دورة جديدة", () => {
    const prompted = { wake_prompt_sent_at: at(18, 3).toISOString() };
    expect(decide(at(18, 13), prompted)).toBeNull();
    expect(decide(at(20), prompted)).toBeNull();
    expect(decide(at(30), prompted, { dueNonEasy: 40 })).toBeNull();
  });

  it("بعد الاستيقاظ تبدأ دورة جديدة بتذكيراتها (رسالة الدورة القديمة لا تُحتسب)", () => {
    const nextStart = at(26);
    const next = { cycle_started_at: nextStart.toISOString(), cycle_date_key: "2026-10-21", wake_prompt_sent_at: at(18, 3).toISOString(), last_vocab_push_at: null };
    expect(decide(new Date(nextStart.getTime() + 2 * 3_600_000), next)).toBe("vocab");
    expect(decide(new Date(nextStart.getTime() + 18 * 3_600_000), next)).toBe("wake");
  });

  it("طول الدورة قابل للتغيير", () => {
    expect(decide(at(12), { cycle_hours: 12 })).toBe("wake");
    expect(decide(at(12), { cycle_hours: 14, reminder_enabled: false })).toBe("vocab");
  });
});

describe("daily plan reminder", () => {
  it("تُرسل مرة واحدة بعد 8 ساعات من الاستيقاظ وتتقدم على تذكير الكلمات", () => {
    expect(decide(at(8))).toBe("daily");
    expect(decide(at(7, 59))).toBe("vocab");
  });

  it("لا تتكرر في الدورة نفسها وتتجدد في الدورة التالية", () => {
    expect(decide(at(8, 10), { last_daily_push_date: "2026-10-20", last_vocab_push_at: at(8).toISOString() })).toBeNull();
    expect(decide(at(10), { last_daily_push_date: "2026-10-20", last_vocab_push_at: at(8).toISOString() })).toBe("vocab");
    const nextStart = at(26);
    expect(decide(new Date(nextStart.getTime() + 8 * 3_600_000), { cycle_started_at: nextStart.toISOString(), cycle_date_key: "2026-10-21", last_daily_push_date: "2026-10-20" })).toBe("daily");
  });

  it("لا تُرسل إذا اكتملت المهام أو كانت معطلة", () => {
    expect(decide(at(8), {}, { pendingTasks: 0 })).toBe("vocab");
    expect(decide(at(8), { reminder_enabled: false })).toBe("vocab");
  });
});

describe("messages", () => {
  it("رسالة الكلمات تعد كل فئة غير سهلة", () => {
    const message = vocabMessage({ again: 2, hard: 3, good: 4, fresh: 0 });
    expect(message.body).toContain("9 كلمة");
    expect(message.body).toContain("2 لم أتذكرها");
    expect(message.body).toContain("3 صعبة");
    expect(message.body).toContain("4 للنطق والإملاء");
    expect(message.body).not.toContain("جديدة");
    expect(message.url).toBe("cards");
  });

  it("رسالة الاستيقاظ تفتح صفحة الاستيقاظ وفيها زر إجراء", () => {
    const message = wakeMessage(18);
    expect(message.url).toBe("wake");
    expect(message.actions[0]).toEqual({ action: "wake", title: "استيقظت" });
    expect(message.body).toContain("18");
  });

  it("رسالة الخطة تذكر عدد المهام المتبقية", () => {
    expect(dailyMessage(3).body).toContain("3");
    expect(dailyMessage(1).url).toBe("");
  });
});
