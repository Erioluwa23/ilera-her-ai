import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key() {
  const encoded = process.env.CYCLE_DATA_ENCRYPTION_KEY;
  if (!encoded || !/^[A-Za-z0-9+/]{43}=$/.test(encoded))
    throw new Error("Cycle encryption is not configured");
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length !== 32)
    throw new Error("Cycle encryption is not configured");
  return decoded;
}
// The server can decrypt for an authenticated owner; this is not end-to-end encryption.
export function encryptCycle(value: unknown, userId: string, record: string) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), nonce, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(`ileraher-cycle:v1:${userId}:${record}`));
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    bytes.toString("base64"),
  ].join(".");
}
export function decryptCycle<T>(
  payload: string,
  userId: string,
  record: string,
): T {
  const [version, iv, tag, bytes, extra] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !bytes || extra)
    throw new Error("Invalid encrypted cycle record");
  if (
    Buffer.from(iv, "base64").length !== 12 ||
    Buffer.from(tag, "base64").length !== 16
  )
    throw new Error("Invalid encrypted cycle record");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64"),
    { authTagLength: 16 },
  );
  decipher.setAAD(Buffer.from(`ileraher-cycle:v1:${userId}:${record}`));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(bytes, "base64")),
      decipher.final(),
    ]).toString("utf8"),
  ) as T;
}
