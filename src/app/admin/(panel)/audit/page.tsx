import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { buttonStyles } from "@/components/ui/button";
import { AdminHeader, AdminPagination, pageNum } from "@/features/admin/components/admin-ui";
import { platformAuditLog } from "@/features/admin/server/admin-service";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const metadata = { title: "Audit log" };

const PREFIXES = [
  "admin.",
  "user.",
  "organization.",
  "department.",
  "agent.",
  "credential.",
  "permission.",
];

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requirePlatformAdmin();
  const sp = await searchParams;
  const action = PREFIXES.includes(String(sp.action)) ? String(sp.action) : undefined;
  const page = pageNum(sp.page);
  const { total, rows } = await platformAuditLog(admin, { action, page });

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <AdminHeader
        title="Audit log"
        description="Every security-relevant action across all customers. Immutable."
      />
      <form className="flex gap-2">
        <Select
          name="action"
          defaultValue={action ?? ""}
          aria-label="Filter by action"
          className="w-56"
        >
          <option value="">All actions</option>
          {PREFIXES.map((p) => (
            <option key={p} value={p}>
              {p}*
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonStyles("secondary", "md")}>
          Filter
        </button>
      </form>
      <Card className="overflow-hidden rounded-[22px]">
        <div className="scroller-x">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] tracking-wide text-muted uppercase">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap text-muted">
                    {r.createdAt.toLocaleString("en-US", {
                      dateStyle: "short",
                      timeStyle: "medium",
                    })}
                  </td>
                  <td
                    className={`px-4 py-2.5 font-mono text-xs ${r.action.startsWith("admin.") ? "text-orange" : "text-foreground"}`}
                  >
                    {r.action}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{r.actor?.email ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{r.organization?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted">
                    {r.resourceType}
                    {r.resourceId ? `:${r.resourceId}` : ""}
                  </td>
                  <td
                    className="max-w-xs truncate px-4 py-2.5 font-mono text-[11px] text-muted"
                    title={JSON.stringify(r.metadata)}
                  >
                    {JSON.stringify(r.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <AdminPagination
        page={page}
        total={total}
        href={(p) =>
          `/admin/audit?${new URLSearchParams({ ...(action ? { action } : {}), page: String(p) })}`
        }
      />
    </div>
  );
}
