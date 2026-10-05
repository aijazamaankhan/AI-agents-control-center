import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeRedirectPath } from "@/features/auth/schemas";
import { db } from "@/lib/db/client";

export const metadata: Metadata = { title: "Sign in" };

/** Seeded by `scripts/seed-demo.mjs` (development only). */
const DEMO = { email: "demo@agentos.dev", password: "AgentOS-demo-2026" };

async function demoAccountExists(): Promise<boolean> {
  if (process.env.NODE_ENV === "production") return false;
  try {
    return Boolean(
      await db.user.findUnique({ where: { email: DEMO.email }, select: { id: true } }),
    );
  } catch {
    return false;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeRedirectPath(next, "") : "";
  const showDemo = await demoAccountExists();

  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Sign in to AgentOS</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Welcome back to your AI workforce.</p>
      <LoginForm next={nextPath || undefined} demo={showDemo ? DEMO : undefined} />
    </>
  );
}
