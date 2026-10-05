import { randomBytes } from "node:crypto";

// Crockford base32 (no I, L, O, U) — the ULID alphabet.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const ID_PREFIXES = {
  organization: "org",
  user: "usr",
  membership: "mem",
  session: "ses",
  audit: "aud",
  department: "dep",
  agent: "agt",
  task: "task",
  execution: "exec",
  event: "evt",
  approval: "apr",
  inquiry: "inq",
  credential: "cred",
  apiKey: "key",
  capability: "cap",
  price: "prc",
  cost: "cst",
} as const;

export type IdKind = keyof typeof ID_PREFIXES;

function encodeTime(ms: number): string {
  let value = ms;
  let out = "";
  for (let i = 0; i < 10; i++) {
    out = ALPHABET[value % 32] + out;
    value = Math.floor(value / 32);
  }
  return out;
}

function encodeRandom(): string {
  // 80 bits of randomness → 16 base32 chars (5 bits each).
  const bytes = randomBytes(10);
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  return out;
}

/** ULID body: 26 chars, lexicographically sortable by creation time. */
export function ulid(now: number = Date.now()): string {
  return encodeTime(now) + encodeRandom();
}

/** Permanent, prefixed, time-sortable identifier, e.g. `agt_01J9Z3...`. */
export function newId(kind: IdKind, now?: number): string {
  return `${ID_PREFIXES[kind]}_${ulid(now)}`;
}

export function hasPrefix(id: string, kind: IdKind): boolean {
  return new RegExp(`^${ID_PREFIXES[kind]}_[${ALPHABET}]{26}$`).test(id);
}
