import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeRedirectPath } from "@/features/auth/schemas";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? safeRedirectPath(next, "") : "";

  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Sign in to AgentOS</h1>
      <p className="mt-1 mb-6 text-sm text-muted">Welcome back to your AI workforce.</p>
      <LoginForm next={nextPath || undefined} />
    </>
  );
}
