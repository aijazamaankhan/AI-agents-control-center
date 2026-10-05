import "server-only";
import accounts from "@/config/demo-accounts.json";
import { db } from "@/lib/db/client";

export interface DemoLogin {
  label: string;
  email: string;
  password: string;
}

/**
 * Local development only: the seeded demo logins (docs/LOGINS.md) for the quick-fill box on the
 * sign-in pages. Returns [] in production or when the seed hasn't run, so nothing leaks.
 */
export async function demoLogins(kind: "company" | "admin"): Promise<DemoLogin[]> {
  if (process.env.NODE_ENV === "production") return [];
  const list: DemoLogin[] =
    kind === "admin"
      ? [{ label: "Platform admin", ...pick(accounts.platformAdmin) }]
      : accounts.companies.flatMap((c) =>
          c.users.map((u) => ({
            label: `${c.name.replace(" (Demo)", "")} · ${u.role.toLowerCase()}`,
            ...pick(u),
          })),
        );
  try {
    const found = await db.user.findMany({
      where: { email: { in: list.map((l) => l.email) } },
      select: { email: true },
    });
    const seeded = new Set(found.map((u) => u.email));
    return list.filter((l) => seeded.has(l.email));
  } catch {
    return [];
  }
}

function pick(u: { email: string; password: string }) {
  return { email: u.email, password: u.password };
}
