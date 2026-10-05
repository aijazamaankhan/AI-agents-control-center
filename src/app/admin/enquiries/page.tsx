import Link from "next/link";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/features/agents/format";
import { AdminActionButton } from "@/features/admin/components/admin-action-button";
import { AdminHeader, AdminPagination, pageNum, Pill } from "@/features/admin/components/admin-ui";
import { listInquiriesAdmin } from "@/features/admin/server/admin-service";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";

export const metadata = { title: "Enquiries" };

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "handled", label: "Handled" },
  { key: "all", label: "All" },
] as const;

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requirePlatformAdmin();
  const sp = await searchParams;
  const status = (
    ["open", "handled", "all"].includes(String(sp.status)) ? String(sp.status) : "open"
  ) as "open" | "handled" | "all";
  const type = sp.type === "DEMO" || sp.type === "SERVICE" ? sp.type : undefined;
  const page = pageNum(sp.page);
  const { total, rows } = await listInquiriesAdmin(admin, {
    status: status === "all" ? undefined : status,
    type,
    page,
  });
  const href = (s: string, t?: string, p = 1) =>
    `/admin/enquiries?${new URLSearchParams({ status: s, ...(t ? { type: t } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <AdminHeader
        title="Enquiries"
        description="Development & design requests and AgentOS demo requests from the website."
      />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href(f.key, type)}
            aria-current={status === f.key ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              status === f.key
                ? "border-orange bg-orange/15 text-foreground"
                : "border-border text-muted hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
        <span className="mx-1 w-px bg-border" />
        {[undefined, "SERVICE", "DEMO"].map((t) => (
          <Link
            key={t ?? "any"}
            href={href(status, t)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              type === t
                ? "border-orange bg-orange/15 text-foreground"
                : "border-border text-muted hover:text-foreground",
            )}
          >
            {t === "SERVICE" ? "Velorex projects" : t === "DEMO" ? "Demo requests" : "All types"}
          </Link>
        ))}
      </div>
      <ul className="space-y-3" aria-label="Enquiries">
        {rows.map((r) => (
          <li key={r.id}>
            <Card className="rounded-[18px] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {r.name}
                    {r.company ? <span className="text-muted">· {r.company}</span> : null}
                    <Pill tone={r.type === "DEMO" ? "warn" : "ok"}>
                      {r.type === "DEMO" ? "Demo request" : r.service}
                    </Pill>
                    {r.handledAt ? <Pill tone="muted">Handled</Pill> : null}
                  </p>
                  <p className="text-xs text-muted">
                    <a href={`mailto:${r.email}`} className="text-primary hover:underline">
                      {r.email}
                    </a>
                    {r.phone ? ` · ${r.phone}` : ""} · {relativeTime(r.createdAt)}
                    {r.budget ? ` · ${r.budget}` : ""}
                    {r.timeline ? ` · ${r.timeline}` : ""}
                    {r.teamSize ? ` · team ${r.teamSize}` : ""} ·{" "}
                    {r.emailDelivered ? "emailed ✓" : `not emailed (${r.emailError ?? "pending"})`}
                  </p>
                  {r.message ? (
                    <p className="max-w-3xl text-sm whitespace-pre-wrap text-foreground">
                      {r.message}
                    </p>
                  ) : null}
                </div>
                <AdminActionButton
                  op={r.handledAt ? "inquiry.reopen" : "inquiry.handled"}
                  id={r.id}
                  label={r.handledAt ? "Reopen" : "Mark handled"}
                />
              </div>
            </Card>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="py-10 text-center text-sm text-muted">No enquiries here.</li>
        ) : null}
      </ul>
      <AdminPagination page={page} total={total} href={(p) => href(status, type, p)} />
    </div>
  );
}
