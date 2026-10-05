"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const content = (
          <>
            <Icon aria-hidden className="size-[18px] shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {!item.available ? (
              <span className="rounded-full border border-border px-1.5 text-[10px] font-medium tracking-wide text-muted uppercase">
                Soon
              </span>
            ) : null}
          </>
        );
        const base = "flex h-9 items-center gap-3 rounded-control px-3 text-sm transition-colors";

        if (!item.available) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className={cn(base, "cursor-not-allowed text-muted/60")}
            >
              {content}
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              base,
              active
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted hover:bg-raised hover:text-foreground",
            )}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
