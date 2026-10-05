import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentSession } from "@/lib/auth/guards";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await getCurrentSession()) redirect("/dashboard");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <ThemeToggle className="absolute top-4 right-4" />
      <Link href="/" className="mb-8" aria-label="AgentOS home">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 sm:p-8">
        {children}
      </div>
      <p className="mt-4 font-mono text-[10px] text-muted/70">
        {process.env.NEXT_PUBLIC_APP_VERSION}
      </p>
    </div>
  );
}
