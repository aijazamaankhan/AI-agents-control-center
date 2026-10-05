import { ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { STUDIO } from "@/config/site";
import { logoutAction } from "@/features/auth/actions";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · AgentOS" },
  robots: { index: false },
};

/** Separate shell for Velorex Studio staff — deliberately distinct from the customer app. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requirePlatformAdmin();
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-b border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-control bg-orange text-background">
            <ShieldCheck aria-hidden className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{STUDIO.name}</p>
            <p className="text-[11px] tracking-wide text-orange uppercase">Platform admin</p>
          </div>
        </div>
        <div className="px-3 pb-3 lg:flex-1">
          <AdminNav />
        </div>
        <div className="hidden space-y-2 border-t border-border p-3 lg:block">
          <Link
            href="/dashboard"
            className="flex h-9 items-center gap-3 rounded-control px-3 text-sm text-muted hover:bg-raised hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="size-4" /> Back to AgentOS
          </Link>
          <p className="truncate px-3 text-xs text-muted">{admin.user.email}</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex h-14 items-center justify-end gap-2 border-b border-border px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="mr-auto text-sm text-muted hover:text-foreground lg:hidden"
          >
            ← AgentOS
          </Link>
          <ThemeToggle />
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-2 rounded-control px-3 text-sm text-muted hover:bg-raised hover:text-foreground"
            >
              <LogOut aria-hidden className="size-4" /> Sign out
            </button>
          </form>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
