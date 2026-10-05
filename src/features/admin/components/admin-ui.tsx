import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_PAGE_SIZE } from "../server/admin-service";

export function AdminHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
    </div>
  );
}

export function AdminSearch({
  q,
  placeholder,
  extra,
}: {
  q?: string;
  placeholder: string;
  extra?: React.ReactNode;
}) {
  return (
    <form
      role="search"
      className="flex flex-wrap gap-2 rounded-[18px] border border-border bg-surface p-3"
    >
      <div className="relative min-w-60 flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        />
        <Input
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-9"
        />
      </div>
      {extra}
      <button type="submit" className={buttonStyles("secondary", "md")}>
        Search
      </button>
    </form>
  );
}

export function AdminPagination({
  page,
  total,
  href,
}: {
  page: number;
  total: number;
  href: (p: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between text-sm text-muted">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <span className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonStyles("secondary", "sm")}>
            <ChevronLeft aria-hidden className="size-4" /> Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className={buttonStyles("secondary", "sm")}>
            Next <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </span>
    </nav>
  );
}

export function Pill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "muted";
  children: React.ReactNode;
}) {
  const cls = {
    ok: "border-primary/30 bg-primary/10 text-primary",
    warn: "border-warning/30 bg-warning/10 text-warning",
    bad: "border-error/30 bg-error/10 text-error",
    muted: "border-border bg-raised text-muted",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

export const pageNum = (v: string | string[] | undefined) =>
  Math.max(1, Number.parseInt(Array.isArray(v) ? (v[0] ?? "1") : (v ?? "1"), 10) || 1);
export const qParam = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 100) || undefined;
