import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  b64urlToBytes,
  bytesToB64url,
  dailyMessage,
  decideReminders,
  encryptPayload,
  localParts,
  vapidAuthorization,
  vocabMessage,
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

const prefs: ReminderPrefs = {
  timezone: "Asia/Riyadh",
  reminder_enabled: true,
  reminder_hour_local: 20,
  vocab_reminder_enabled: true,
  vocab_reminder_every_hours: 3,
  reminder_window_start: 9,
  reminder_window_end: 21,
  last_vocab_push_at: null,
  last_daily_push_date: null,
};

describe("local time", () => {
  it("يحوّل الوقت إلى توقيت المتعلم ويعيد التاريخ المحلي", () => {
    expect(localParts(new Date("2026-10-16T17:30:00Z"), "Asia/Riyadh")).toEqual({ hour: 20, dateKey: "2026-10-16" });
    expect(localParts(new Date("2026-10-16T22:30:00Z"), "Asia/Riyadh")).toEqual({ hour: 1, dateKey: "2026-10-17" });
    expect(localParts(new Date("2026-10-16T00:10:00Z"), "UTC")).toEqual({ hour: 0, dateKey: "2026-10-16" });
  });

  it("يرجع إلى UTC إذا كان اسم المنطقة الزمنية غير صالح", () => {
    expect(localParts(new Date("2026-10-16T05:00:00Z"), "Not/AZone")).toEqual({ hour: 5, dateKey: "2026-10-16" });
  });
});

describe("decideReminders", () => {
  const at = (iso: string) => new Date(iso);
  const base = { vocabularyDone: false, pendingTasks: 5 };

  it("يرسل تذكير المفردات بعد مرور ثلاث ساعات داخل نافذة النهار", () => {
    const decision = decideReminders({ ...base, now: at("2026-10-16T09:00:00Z"), prefs: { ...prefs, last_vocab_push_at: "2026-10-16T06:00:00Z" } }); // 12:00 Riyadh
    expect(decision).toMatchObject({ vocab: true, daily: false });
  });

  it("يرسل أول تذكير مفردات عندما لا يوجد تذكير سابق", () => {
    expect(decideReminders({ ...base, now: at("2026-10-16T09:00:00Z"), prefs }).vocab).toBe(true);
  });

  it("لا يكرر قبل مرور الفترة (مع هامش تأخر الجدولة)", () => {
    expect(decideReminders({ ...base, now: at("2026-10-16T09:00:00Z"), prefs: { ...prefs, last_vocab_push_at: "2026-10-16T07:30:00Z" } }).vocab).toBe(false);
    // 2h51m later still counts as three hours because the cron job can drift a few minutes
    expect(decideReminders({ ...base, now: at("2026-10-16T09:00:00Z"), prefs: { ...prefs, last_vocab_push_at: "2026-10-16T06:09:00Z" } }).vocab).toBe(true);
  });

  it("لا يرسل ليلًا خارج نافذة التذكير", () => {
    expect(decideReminders({ ...base, now: at("2026-10-16T21:00:00Z"), prefs }).vocab).toBe(false); // 00:00 Riyadh
    expect(decideReminders({ ...base, now: at("2026-10-16T05:00:00Z"), prefs }).vocab).toBe(false); // 08:00 Riyadh
    expect(decideReminders({ ...base, now: at("2026-10-16T18:00:00Z"), prefs }).vocab).toBe(false); // 21:00 Riyadh, window ends at 21
  });

  it("يتوقف عن تذكير المفردات بعد إكمال مهمة المفردات اليوم", () => {
    expect(decideReminders({ ...base, vocabularyDone: true, now: at("2026-10-16T09:00:00Z"), prefs }).vocab).toBe(false);
  });

  it("يحترم إيقاف تذكير المفردات", () => {
    expect(decideReminders({ ...base, now: at("2026-10-16T09:00:00Z"), prefs: { ...prefs, vocab_reminder_enabled: false } }).vocab).toBe(false);
  });

  it("يرسل التذكير العام في الساعة المحددة مرة واحدة في اليوم ولا يرسل تذكير المفردات معه", () => {
    const first = decideReminders({ ...base, now: at("2026-10-16T17:00:00Z"), prefs }); // 20:00 Riyadh
    expect(first).toMatchObject({ daily: true, vocab: false, localDateKey: "2026-10-16" });
    const again = decideReminders({ ...base, now: at("2026-10-16T17:30:00Z"), prefs: { ...prefs, last_daily_push_date: "2026-10-16" } });
    expect(again.daily).toBe(false);
    const nextDay = decideReminders({ ...base, now: at("2026-10-17T17:00:00Z"), prefs: { ...prefs, last_daily_push_date: "2026-10-16" } });
    expect(nextDay.daily).toBe(true);
  });

  it("لا يرسل التذكير العام إذا اكتملت كل مهام اليوم أو كان معطلًا أو في ساعة أخرى", () => {
    expect(decideReminders({ ...base, pendingTasks: 0, now: at("2026-10-16T17:00:00Z"), prefs }).daily).toBe(false);
    expect(decideReminders({ ...base, now: at("2026-10-16T17:00:00Z"), prefs: { ...prefs, reminder_enabled: false } }).daily).toBe(false);
    expect(decideReminders({ ...base, now: at("2026-10-16T16:00:00Z"), prefs }).daily).toBe(false);
  });
});

describe("messages", () => {
  it("تذكر عدد البطاقات والمهام المتبقية", () => {
    expect(vocabMessage(7).body).toContain("7");
    expect(vocabMessage(0).body).toContain("كلمات اليوم");
    expect(dailyMessage(3).body).toContain("3");
    expect(vocabMessage(1).url).toBe("cards");
    expect(dailyMessage(1).url).toBe("");
  });
});
