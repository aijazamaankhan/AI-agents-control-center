import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AppError } from "@/lib/api/errors";

export const ENCRYPTION_KEY_VERSION = 1;

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

function loadKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  const key = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (key.length !== 32) {
    // Configuration error, not user error — message names the fix, never the value.
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "Credential storage is not configured. Set ENCRYPTION_KEY (32 bytes, base64) — run `npm run setup`.",
    );
  }
  return key;
}

/**
 * AES-256-GCM. `context` (e.g. `${orgId}:${agentId}`) is bound as associated data,
 * so a ciphertext copied onto another agent or tenant fails to decrypt.
 */
export function encryptSecret(plaintext: string, context: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", loadKey(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: ENCRYPTION_KEY_VERSION,
  };
}

export function decryptSecret(secret: EncryptedSecret, context: string): string {
  const decipher = createDecipheriv("aes-256-gcm", loadKey(), Buffer.from(secret.iv, "base64"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(secret.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Display hint that never reveals more than the last 4 characters. */
export function secretHint(value: string): string {
  return value.length <= 8 ? "••••" : `••••${value.slice(-4)}`;
}

export const API_KEY_PREFIX = "aos_live_";

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = API_KEY_PREFIX + randomBytes(32).toString("base64url");
  return { key, prefix: key.slice(0, API_KEY_PREFIX.length + 6), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
