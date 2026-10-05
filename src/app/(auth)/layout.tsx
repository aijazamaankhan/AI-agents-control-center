import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { getCurrentSession } from "@/lib/auth/guards";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await getCurrentSession()) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8" aria-label="AgentOS home">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
