import { Building2, ChevronRight, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NewDepartmentForm } from "@/features/departments/components/department-form";
import { MAX_DEPARTMENTS } from "@/features/departments/schemas";
import { listDepartments } from "@/features/departments/server/department-service";
import { DepartmentIcon } from "@/features/workforce/components/department-icon";
import { departmentAccent, tint } from "@/features/workforce/visuals";
import { requireOrgContext } from "@/lib/auth/guards";
import { can } from "@/lib/security/permissions";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const ctx = await requireOrgContext();
  const departments = await listDepartments(ctx);
  const canManage = can(ctx.role, "departments:manage");

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Departments</h1>
        <p className="mt-1 text-sm text-muted">
          {departments.length} of {MAX_DEPARTMENTS} departments · group your AI agents by the team
          that owns them.
        </p>
      </div>

      {canManage ? (
        <Card className="rounded-[22px]">
          <CardContent>
            <NewDepartmentForm />
          </CardContent>
        </Card>
      ) : (
        <p className="flex items-center gap-2 rounded-control border border-border bg-raised px-3 py-2 text-sm text-muted">
          <Lock aria-hidden className="size-4" /> Only owners and admins can create or change
          departments.
        </p>
      )}

      {departments.length === 0 ? (
        <Card className="rounded-[22px]">
          <EmptyState
            icon={Building2}
            title="Create your first department."
            description="Departments organize your AI workforce — e.g. Sales, Customer Support, Finance."
          />
        </Card>
      ) : (
        <ul
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          aria-label="Departments"
        >
          {departments.map((dep, i) => {
            const accent = departmentAccent(dep.name, i);
            return (
              <li key={dep.id}>
                <Link
                  href={`/departments/${dep.id}`}
                  className="group flex h-full flex-col rounded-[20px] border bg-surface p-5 transition-[border-color,box-shadow] hover:bg-raised"
                  style={{ borderColor: tint(accent, 25) }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="flex size-10 items-center justify-center rounded-card"
                      style={{ background: tint(accent, 14), color: accent }}
                    >
                      <DepartmentIcon name={dep.name} className="size-5" />
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="size-4 text-muted group-hover:text-foreground"
                    />
                  </div>
                  <h2 className="mt-4 truncate text-base font-semibold text-foreground">
                    {dep.name}
                  </h2>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted">
                    {dep.description || "No description"}
                  </p>
                  <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
                    <div>
                      <p className="font-display text-3xl leading-none font-medium text-foreground tabular-nums">
                        0
                      </p>
                      <p className="mt-1 text-[11px] tracking-wide text-muted uppercase">Agents</p>
                    </div>
                    <p className="text-[11px] text-muted">Agents arrive in Phase 3</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
