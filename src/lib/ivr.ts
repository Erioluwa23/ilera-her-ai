import {
  createHmac,
  timingSafeEqual,
  randomUUID,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import twilio from "twilio";
import type { IlaraLanguage } from "./languages";
export function xmlEscape(input: string) {
  return input.replace(
    /[<>&'\"]/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[c]!,
  );
}
export function twiml(body: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`,
    {
      headers: {
        "content-type": "text/xml; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
export const DIGIT_LANGUAGE: Record<string, IlaraLanguage> = {
  "1": "en-NG",
  "2": "yo",
  "3": "ha",
  "4": "ig",
};
export type CallState = {
  id: string;
  call: string;
  language: IlaraLanguage;
  expires: number;
  consented: boolean;
  callerKey?: string;
  profileId?: string;
  previous?: string;
};
export function publicOrigin() {
  const url = new URL(process.env.IVR_PUBLIC_BASE_URL || "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Invalid public IVR origin");
  return url.origin;
}
function secret() {
  const key = process.env.IVR_SESSION_SECRET;
  if (!key || key.length < 32)
    throw new Error("IVR session key is not configured");
  return key;
}
export function stateToken(
  call: string,
  language: IlaraLanguage,
  consented = false,
) {
  const state: CallState = {
    id: randomUUID(),
    call,
    language,
    consented,
    expires: Date.now() + 20 * 60 * 1000,
  };
  return signState(state);
}
export function signState(state: CallState) {
  const data = Buffer.from(JSON.stringify(state)).toString("base64url");
  return (
    data + "." + createHmac("sha256", secret()).update(data).digest("base64url")
  );
}
export function readState(token: string, call?: string): CallState {
  if (token.length > 2048) throw new Error("Invalid state");
  const [data, sig, extra] = token.split(".");
  if (!data || !sig || extra) throw new Error("Invalid state");
  const expected = createHmac("sha256", secret()).update(data).digest(),
    actual = Buffer.from(sig, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Invalid state");
  const state = JSON.parse(
    Buffer.from(data, "base64url").toString(),
  ) as CallState;
  if (
    (state.callerKey !== undefined && !/^[a-f0-9]{64}$/.test(state.callerKey)) ||
    (state.profileId !== undefined && !/^[a-f0-9-]{36}$/.test(state.profileId)) ||
    (state.previous !== undefined && !/^[a-f0-9-]{36}$/.test(state.previous)) ||
    !/^[a-f0-9-]{36}$/.test(state.id) ||
    !/^CA[a-f0-9]{32}$/i.test(state.call) ||
    !Object.values(DIGIT_LANGUAGE).includes(state.language) ||
    typeof state.consented !== "boolean" ||
    !Number.isFinite(state.expires) ||
    state.expires < Date.now() ||
    state.expires > Date.now() + 21 * 60 * 1000 ||
    (call && state.call !== call)
  )
    throw new Error("Expired or mismatched state");
  return state;
}
export function callHash(call: string) {
  return createHmac("sha256", secret())
    .update("call:" + call)
    .digest("hex");
}
export function encryptResult(value: unknown) {
  const iv = randomBytes(12),
    key = createHash("sha256")
      .update("ivr-result:" + secret())
      .digest(),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function decryptResult<T>(value: string): T {
  const data = Buffer.from(value, "base64"),
    key = createHash("sha256")
      .update("ivr-result:" + secret())
      .digest(),
    decipher = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(data.subarray(28)),
      decipher.final(),
    ]).toString(),
  );
}
export async function webhook(req: Request) {
  if (!process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_ACCOUNT_SID)
    throw new Error("Provider not configured");
  if (
    !req.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
  )
    throw new Error("Invalid body");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Missing body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  const form = new URLSearchParams(Buffer.concat(chunks).toString());
  const values: Record<string, string> = {};
  for (const [key, value] of form) {
    if (key in values) throw new Error("Duplicate parameter");
    values[key] = value;
  }
  const incoming = new URL(req.url);
  const url = publicOrigin() + incoming.pathname + incoming.search;
  if (
    !twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      req.headers.get("x-twilio-signature") || "",
      url,
      values,
    ) ||
    values.AccountSid !== process.env.TWILIO_ACCOUNT_SID ||
    !/^CA[a-f0-9]{32}$/i.test(values.CallSid || "")
  )
    throw new Error("Invalid webhook");
  return values;
}
export function route(
  name: string,
  token?: string,
  extra: Record<string, string> = {},
) {
  const url = new URL("/api/ivr/" + name, publicOrigin());
  if (token) url.searchParams.set("state", token);
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v));
  return xmlEscape(url.toString());
}
export function say(text: string) {
  return `<Say language="en-GB">${xmlEscape(text)}</Say>`;
}
export function configuredLanguages(): IlaraLanguage[] {
  const all: IlaraLanguage[] = ["en-NG"];
  if (process.env.IVR_PROMPT_BASE_URL && process.env.IVR_TTS_API_URL) {
    for (const value of (process.env.IVR_TTS_LANGUAGES || "").split(",")) {
      if (value === "yo" || value === "ha" || value === "ig") all.push(value);
    }
  }
  return [...new Set(all)];
}
export function configuration() {
  const checks = {
    enabled: process.env.IVR_ENABLED === "true",
    provider:
      !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
    number: /^\+[1-9]\d{6,14}$/.test(process.env.IVR_PHONE_NUMBER || ""),
    origin: false,
    secret: (process.env.IVR_SESSION_SECRET?.length || 0) >= 32,
    database: !!process.env.IVR_DATABASE_URL,
    llm: true, // The shared N-ATLaS runtime is the default provider.
  };
  try {
    publicOrigin();
    checks.origin = true;
  } catch {}
  return {
    checks,
    configured: Object.values(checks).every(Boolean),
    languages: configuredLanguages(),
  };
}
export function prompt(language: IlaraLanguage, name: string, english: string) {
  if (language === "en-NG") return say(english);
  const base = new URL(process.env.IVR_PROMPT_BASE_URL || "");
  if (base.protocol !== "https:") throw new Error("Invalid audio prompts");
  return `<Play>${xmlEscape(new URL(`${language}/${name}.mp3`, base.href.replace(/\/?$/, "/")).href)}</Play>`;
}
export function failWebhook() {
  return new Response("Forbidden", {
    status: 403,
    headers: { "cache-control": "no-store" },
  });
}
