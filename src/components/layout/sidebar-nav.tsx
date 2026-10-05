"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SECONDARY_NAV, type NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <NavList items={NAV_ITEMS} label="Main" onNavigate={onNavigate} />
      <div className="mt-auto border-t border-border pt-3">
        <NavList items={SECONDARY_NAV} label="Support" onNavigate={onNavigate} />
      </div>
    </div>
  );
}

function NavList({
  items,
  label,
  onNavigate,
}: {
  items: NavItem[];
  label: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="space-y-0.5">
      {items.map((item) => {
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
              "relative",
              active
                ? "bg-primary/10 font-medium text-foreground before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-1 before:rounded-r-full before:bg-primary before:shadow-[0_0_12px_var(--color-primary)] [&>svg]:text-primary"
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
