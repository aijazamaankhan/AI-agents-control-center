import Link from "next/link";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/features/agents/format";
import {
  AdminHeader,
  AdminPagination,
  AdminSearch,
  pageNum,
  Pill,
  qParam,
} from "@/features/admin/components/admin-ui";
import { listOrganizationsAdmin } from "@/features/admin/server/admin-service";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const metadata = { title: "Customers" };

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requirePlatformAdmin();
  const sp = await searchParams;
  const q = qParam(sp.q);
  const page = pageNum(sp.page);
  const { total, rows } = await listOrganizationsAdmin(admin, { q, page });

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <AdminHeader
        title="Customers"
        description={`${total} organization${total === 1 ? "" : "s"} on AgentOS`}
      />
      <AdminSearch q={q} placeholder="Search by company, owner email or org_ id" />
      <Card className="overflow-hidden rounded-[22px]">
        <div className="scroller-x">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] tracking-wide text-muted uppercase">
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 text-right font-medium">Members</th>
                <th className="px-4 py-3 text-right font-medium">Departments</th>
                <th className="px-4 py-3 text-right font-medium">Agents</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-raised/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/organizations/${o.id}`}
                      className="font-medium text-foreground hover:text-orange hover:underline"
                    >
                      {o.name}
                    </Link>
                    <p className="text-[11px] text-muted">
                      {o.industry} · {o.country}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted">{o.memberships[0]?.user.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{o._count.memberships}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{o._count.departments}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{o._count.agents}</td>
                  <td className="px-4 py-3 text-muted">{relativeTime(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    {o.suspendedAt ? (
                      <Pill tone="bad">Suspended</Pill>
                    ) : (
                      <Pill tone="ok">Active</Pill>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    No customers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      <AdminPagination
        page={page}
        total={total}
        href={(p) =>
          `/admin/organizations?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`
        }
      />
    </div>
  );
}
