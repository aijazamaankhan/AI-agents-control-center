import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AgentForm } from "@/features/agents/components/agent-form";
import { listDepartments } from "@/features/departments/server/department-service";
import { requireOrgContext } from "@/lib/auth/guards";
import { can } from "@/lib/security/permissions";

export const metadata: Metadata = { title: "Connect agent" };

export default async function NewAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string }>;
}) {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "agents:manage")) redirect("/agents");
  const departments = await listDepartments(ctx);
  if (departments.length === 0) redirect("/departments");
  const { department } = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" /> Agents
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Connect an agent</h1>
        <p className="mt-1 text-sm text-muted">
          Register an agent you already run. It gets a permanent ID and an API key to report its
          work.
        </p>
      </div>
      <AgentForm
        mode="create"
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        defaultDepartmentId={departments.some((d) => d.id === department) ? department : undefined}
      />
    </div>
  );
}
