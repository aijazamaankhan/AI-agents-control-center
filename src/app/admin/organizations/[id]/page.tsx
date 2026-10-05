import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { relativeTime } from "@/features/agents/format";
import { AdminActionButton } from "@/features/admin/components/admin-action-button";
import { AdminHeader, Pill } from "@/features/admin/components/admin-ui";
import { getOrganizationAdmin } from "@/features/admin/server/admin-service";
import { countryName } from "@/features/organizations/constants";
import { AppError } from "@/lib/api/errors";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/security/permissions";

export const metadata = { title: "Customer" };

export default async function AdminOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requirePlatformAdmin();
  const { id } = await params;
  const org = await getOrganizationAdmin(admin, id).catch((e) => {
    if (e instanceof AppError && e.code === "RESOURCE_NOT_FOUND") notFound();
    throw e;
  });

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <Link
        href="/admin/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" /> Customers
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <AdminHeader title={org.name} />
            {org.suspendedAt ? (
              <Pill tone="bad">Suspended {relativeTime(org.suspendedAt)}</Pill>
            ) : (
              <Pill tone="ok">Active</Pill>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {org.industry} · {org.companySize} employees · {countryName(org.country)} ·{" "}
            {org.timezone} · created {relativeTime(org.createdAt)} ·{" "}
            <code className="font-mono text-xs">{org.id}</code>
          </p>
          <p className="mt-1 text-sm text-muted">
            Last 7 days: {org.tasks7d} tasks · {org.events7d} events
          </p>
        </div>
        {org.suspendedAt ? (
          <AdminActionButton
            op="org.reactivate"
            id={org.id}
            label="Reactivate organization"
            variant="primary"
          />
        ) : (
          <AdminActionButton
            op="org.suspend"
            id={org.id}
            label="Suspend organization"
            variant="danger"
            confirm="Block all members and agents?"
          />
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="rounded-[22px]">
          <CardHeader>
            <CardTitle>Members ({org.memberships.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {org.memberships.map((m) => (
                <li
                  key={m.user.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">
                      {m.user.name} {m.user.suspendedAt ? <Pill tone="bad">Suspended</Pill> : null}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {m.user.email} · last sign-in {relativeTime(m.user.lastLoginAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Pill tone="muted">{ROLE_LABELS[m.role]}</Pill>
                    <Link
                      href={`/admin/users?q=${encodeURIComponent(m.user.email)}`}
                      className="text-xs text-primary hover:underline"
                    >
                      Manage
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="rounded-[22px]">
          <CardHeader>
            <CardTitle>Departments ({org.departments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2">
              {org.departments.map((d) => (
                <li
                  key={d.id}
                  className="rounded-full border border-border bg-raised px-3 py-1 text-xs text-foreground"
                >
                  {d.name} <span className="text-muted">· {d._count.agents}</span>
                </li>
              ))}
              {org.departments.length === 0 ? (
                <li className="text-sm text-muted">None yet.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-[22px]">
        <CardHeader>
          <CardTitle>Agents ({org.agents.length})</CardTitle>
        </CardHeader>
        <div className="scroller-x">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-y border-border text-[11px] tracking-wide text-muted uppercase">
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Credentials</th>
                <th className="px-4 py-3 font-medium">API keys</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {org.agents.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{a.name}</p>
                    <p className="text-[11px] text-muted">
                      {a.provider} · {a.model} · active {relativeTime(a.lastActiveAt)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted">{a.department.name}</td>
                  <td className="px-4 py-3">
                    <StatusIndicator status={a.status} />
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-xs text-muted"
                    title="Encrypted at rest — never viewable"
                  >
                    {a.credential ? `🔒 ${a.credential.hint}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {a.apiKeys.length ? (
                      a.apiKeys.map((k) => (
                        <span key={k.prefix} className="flex items-center gap-1">
                          <KeyRound aria-hidden className="size-3" /> {k.prefix}… · used{" "}
                          {relativeTime(k.lastUsedAt)}
                        </span>
                      ))
                    ) : (
                      <Pill tone="muted">No active key</Pill>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.apiKeys.length ? (
                      <AdminActionButton
                        op="agent.revoke_keys"
                        id={a.id}
                        label="Revoke keys"
                        variant="danger"
                        confirm="Revoke all API keys?"
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
              {org.agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No agents connected.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
