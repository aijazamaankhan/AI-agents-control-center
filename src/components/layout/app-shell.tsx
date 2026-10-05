import { Bell, CircleHelp, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

interface AppShellProps {
  user: { name: string; email: string; isPlatformAdmin?: boolean };
  organizationName: string;
  roleLabel: string;
  children: ReactNode;
}

export function AppShell({ user, organizationName, roleLabel, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" aria-label="AgentOS dashboard">
            <Logo />
          </Link>
        </div>
        <div className="px-3 pb-3">
          <div className="rounded-control border border-border bg-raised px-3 py-2">
            <p className="text-[11px] tracking-wide text-muted uppercase">Organization</p>
            <p className="truncate text-sm font-medium text-foreground">{organizationName}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <MobileNav />
          <form action="/search" role="search" className="relative max-w-md flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              name="q"
              aria-label="Search agents, tasks and departments"
              placeholder="Search agents, tasks, departments…"
              className="h-9 w-full rounded-control border border-border bg-surface pr-3 pl-9 text-sm text-foreground placeholder:text-muted/70 focus:border-primary focus:outline-none"
            />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle className="mr-1 hidden sm:inline-flex" />
            <button
              type="button"
              aria-label="Notifications (none)"
              className="flex size-9 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-foreground"
            >
              <Bell aria-hidden className="size-[18px]" />
            </button>
            <Link
              href="/help"
              aria-label="Help & guide"
              className="flex size-9 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-foreground"
            >
              <CircleHelp aria-hidden className="size-[18px]" />
            </Link>
            <div className="ml-2">
              <UserMenu
                name={user.name}
                email={user.email}
                roleLabel={roleLabel}
                organizationName={organizationName}
                isPlatformAdmin={user.isPlatformAdmin}
              />
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
