import type { Metadata } from "next";
import { listAgents } from "@/features/agents/server/agent-service";
import { listDepartments } from "@/features/departments/server/department-service";
import { LiveActivity } from "@/features/events/components/live-activity";
import { recentActivity } from "@/features/events/server/activity";
import { requireOrgContext } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const ctx = await requireOrgContext();
  const [initial, departments, agents] = await Promise.all([
    recentActivity(ctx, { limit: 100 }),
    listDepartments(ctx),
    listAgents(ctx),
  ]);
  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Activity</h1>
        <p className="mt-1 text-sm text-muted">Everything your agents do, as it happens.</p>
      </div>
      <LiveActivity
        initial={initial}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
