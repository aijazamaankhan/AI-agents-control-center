import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "@/lib/api/errors";

/**
 * SSRF guard for server-side requests to user-supplied URLs (agent "Test connection").
 * Blocks loopback, private, link-local, CGNAT, multicast and reserved ranges unless
 * ALLOW_PRIVATE_AGENT_ENDPOINTS=true (local development). Note: a DNS-rebinding
 * window remains between lookup and connect; the request is also redirect-blocked
 * and time-limited (docs/SECURITY.md).
 */
function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipv4ToInt(ip);
    return V4_BLOCKED.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]!);
    if (lower === "::" || lower === "::1") return true;
    const first = parseInt(lower.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    if (lower.startsWith("64:ff9b:") || lower.startsWith("2001:db8:")) return true;
    return false;
  }
  return true; // not an IP at all
}

export function privateEndpointsAllowed(): boolean {
  return process.env.ALLOW_PRIVATE_AGENT_ENDPOINTS === "true";
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError("BAD_REQUEST", "Enter a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new AppError("BAD_REQUEST", "Only http:// and https:// endpoints are supported.");
  }
  if (url.username || url.password) {
    throw new AppError(
      "BAD_REQUEST",
      "Put credentials in the Authentication section, not in the URL.",
    );
  }
  if (privateEndpointsAllowed()) return url;

  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host)
      ? [host]
      : (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
  } catch {
    throw new AppError("BAD_REQUEST", `Could not resolve ${url.hostname}.`);
  }
  if (addresses.length === 0 || addresses.some(isBlockedIp)) {
    throw new AppError(
      "BAD_REQUEST",
      "This endpoint points to a private or local network address, which can't be tested from AgentOS.",
    );
  }
  return url;
}
