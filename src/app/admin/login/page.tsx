import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { STUDIO } from "@/config/site";
import { LoginForm } from "@/features/auth/components/login-form";
import { demoLogins } from "@/features/auth/server/demo-accounts";
import { getCurrentSession } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Admin sign in · AgentOS",
  robots: { index: false },
};

/** Velorex Studio staff sign-in — separate from the company login at /login. */
export default async function AdminLoginPage() {
  const session = await getCurrentSession();
  if (session?.user.isPlatformAdmin) redirect("/admin");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <ThemeToggle className="absolute top-4 right-4" />
      <Link href="/" className="mb-8" aria-label="AgentOS home">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-card border border-orange/40 bg-surface p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-control bg-orange text-background">
            <ShieldCheck aria-hidden className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{STUDIO.name} admin</h1>
            <p className="text-sm text-muted">Platform admin sign in</p>
          </div>
        </div>
        {session ? (
          <p className="mb-4 rounded-control border border-border bg-raised p-3 text-sm text-muted">
            You&apos;re signed in as {session.user.email}, which has no admin access. Sign in with a
            Velorex admin account below.
          </p>
        ) : null}
        <LoginForm variant="admin" demoLogins={await demoLogins("admin")} />
      </div>
      <p className="mt-4 font-mono text-[10px] text-muted/70">
        {process.env.NEXT_PUBLIC_APP_VERSION}
      </p>
    </div>
  );
}
