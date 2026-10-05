import Link from "next/link";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/features/agents/format";
import { AdminActionButton } from "@/features/admin/components/admin-action-button";
import {
  AdminHeader,
  AdminPagination,
  AdminSearch,
  pageNum,
  Pill,
  qParam,
} from "@/features/admin/components/admin-ui";
import { listUsersAdmin } from "@/features/admin/server/admin-service";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/security/permissions";

export const metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requirePlatformAdmin();
  const sp = await searchParams;
  const q = qParam(sp.q);
  const page = pageNum(sp.page);
  const { total, rows } = await listUsersAdmin(admin, { q, page });

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <AdminHeader
        title="Users"
        description="Passwords are stored as one-way hashes and can't be viewed — reset them instead."
      />
      <AdminSearch q={q} placeholder="Search by email, name or usr_ id" />
      <ul className="space-y-3" aria-label="Users">
        {rows.map((u) => {
          const self = u.id === admin.user.id;
          return (
            <li key={u.id}>
              <Card className="rounded-[18px] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      {u.name}
                      {u.isPlatformAdmin ? <Pill tone="warn">Platform admin</Pill> : null}
                      {u.suspendedAt ? (
                        <Pill tone="bad">Suspended</Pill>
                      ) : (
                        <Pill tone="ok">Active</Pill>
                      )}
                      {self ? <Pill tone="muted">You</Pill> : null}
                    </p>
                    <p className="text-xs text-muted">
                      {u.email} · joined {relativeTime(u.createdAt)} · last sign-in{" "}
                      {relativeTime(u.lastLoginAt)} · {u._count.sessions} active session
                      {u._count.sessions === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      {u.memberships.map((m) => (
                        <Link
                          key={m.organization.id}
                          href={`/admin/organizations/${m.organization.id}`}
                          className="rounded-full border border-border px-2 py-0.5 text-muted hover:text-foreground"
                        >
                          {m.organization.name} · {ROLE_LABELS[m.role]}
                        </Link>
                      ))}
                      {u.memberships.length === 0 ? (
                        <span className="text-muted">No organization yet</span>
                      ) : null}
                    </p>
                  </div>
                  {self ? null : (
                    <div className="flex flex-wrap items-start gap-2">
                      <AdminActionButton op="user.signout" id={u.id} label="Sign out everywhere" />
                      <AdminActionButton
                        op="user.reset_password"
                        id={u.id}
                        label="Reset password"
                        confirm="Replace their password with a temporary one?"
                      />
                      {u.suspendedAt ? (
                        <AdminActionButton
                          op="user.reactivate"
                          id={u.id}
                          label="Reactivate"
                          variant="primary"
                        />
                      ) : (
                        <AdminActionButton
                          op="user.suspend"
                          id={u.id}
                          label="Suspend"
                          variant="danger"
                          confirm="Suspend and sign out?"
                        />
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
        {rows.length === 0 ? (
          <li className="py-10 text-center text-sm text-muted">No users found.</li>
        ) : null}
      </ul>
      <AdminPagination
        page={page}
        total={total}
        href={(p) =>
          `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`
        }
      />
    </div>
  );
}
