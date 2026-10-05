import "server-only";
import { cookies } from "next/headers";
import { sessionCookieName, sessionCookieOptions } from "./session-token";

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(sessionCookieName(), token, sessionCookieOptions(expiresAt));
}

export async function readSessionCookie(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

export async function clearSessionCookie() {
  (await cookies()).delete(sessionCookieName());
}
