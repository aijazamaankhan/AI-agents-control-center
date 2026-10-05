"use client";

import {
  Building2,
  CircleDollarSign,
  FileClock,
  Inbox,
  LayoutDashboard,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/organizations", label: "Customers", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
  { href: "/admin/pricing", label: "Pricing", icon: CircleDollarSign },
  { href: "/admin/audit", label: "Audit log", icon: FileClock },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center gap-3 rounded-control px-3 text-sm whitespace-nowrap transition-colors",
              active
                ? "bg-orange/15 font-medium text-foreground [&>svg]:text-orange"
                : "text-muted hover:bg-raised hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
