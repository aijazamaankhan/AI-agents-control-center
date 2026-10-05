import { Activity, Bot, Building2, Inbox, ListChecks, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { relativeTime } from "@/features/agents/format";
import { AdminHeader, Pill } from "@/features/admin/components/admin-ui";
import { platformOverview } from "@/features/admin/server/admin-service";
import { requirePlatformAdmin } from "@/lib/auth/guards";

export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const admin = await requirePlatformAdmin();
  const { counts, recentOrgs, recentInquiries } = await platformOverview(admin);
  const kpis = [
    {
      label: "Customers",
      value: counts.organizations,
      icon: Building2,
      accent: "var(--color-orange)",
      caption: `${counts.suspendedOrgs} suspended`,
    },
    {
      label: "Users",
      value: counts.users,
      icon: Users,
      accent: "var(--color-cyan)",
      caption: `${counts.newUsers} new this week`,
    },
    {
      label: "Agents",
      value: counts.agents,
      icon: Bot,
      accent: "var(--color-primary)",
      caption: `${counts.activeAgents} online now`,
    },
    {
      label: "Tasks 24h",
      value: counts.tasks24h,
      icon: ListChecks,
      accent: "var(--color-purple)",
      caption: "All customers",
    },
    {
      label: "Events 24h",
      value: counts.events24h,
      icon: Activity,
      accent: "var(--color-lime)",
      caption: "Ingested",
    },
    {
      label: "Open enquiries",
      value: counts.openInquiries,
      icon: Inbox,
      accent: "var(--color-warning)",
      caption: "Need a reply",
    },
  ];
  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <AdminHeader
        title="Platform overview"
        description="Every AgentOS customer, user and request in one place."
      />
      <section
        aria-label="Platform KPIs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} value={k.value.toLocaleString("en-US")} />
        ))}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[22px]">
          <CardHeader>
            <CardTitle>Newest customers</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {recentOrgs.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/organizations/${o.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 hover:text-foreground"
                  >
                    <span className="truncate text-sm text-foreground">{o.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {o.suspendedAt ? <Pill tone="bad">Suspended</Pill> : null}
                      {relativeTime(o.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
              {recentOrgs.length === 0 ? (
                <li className="py-2.5 text-sm text-muted">No customers yet.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
        <Card className="rounded-[22px]">
          <CardHeader>
            <CardTitle>Open enquiries</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {recentInquiries.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">
                      {i.name}{" "}
                      {i.company ? <span className="text-muted">· {i.company}</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {i.type === "DEMO" ? "Demo request" : i.service}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{relativeTime(i.createdAt)}</span>
                </li>
              ))}
              {recentInquiries.length === 0 ? (
                <li className="py-2.5 text-sm text-muted">Inbox zero.</li>
              ) : null}
            </ul>
            <Link
              href="/admin/enquiries"
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              <UserPlus aria-hidden className="mr-1 inline size-4" /> All enquiries
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
