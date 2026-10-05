import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST as postEvent } from "@/app/api/agent-events/route";
import { agentSchema } from "@/features/agents/schemas";
import { createAgent } from "@/features/agents/server/agent-service";
import { createDepartment } from "@/features/departments/server/department-service";
import { desktopSummary } from "@/features/desktop/server/desktop-service";
import { createTenant } from "../support/factories";

async function setup(name: string) {
  const t = await createTenant(name);
  const dep = await createDepartment(t.ctx, { name: "Sales", description: "" });
  const { apiKey } = await createAgent(
    t.ctx,
    agentSchema.parse({
      name: "Outreach Writer",
      departmentId: dep.id,
      provider: "OpenAI",
      model: "GPT-5",
      connectionType: "SDK",
    }),
  );
  const send = async (body: unknown) =>
    (
      await (
        await postEvent(
          new Request("http://localhost/api/agent-events", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Idempotency-Key": randomUUID(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          }),
        )
      ).json()
    ).data;
  return { ...t, send };
}

describe("desktop summary", () => {
  it("returns pending approvals, recent failures and agent counts for the caller's org only", async () => {
    const a = await setup("Desktop A");
    const b = await setup("Desktop B");
    const task = await a.send({ event_type: "task.started", name: "Outreach" });
    await a.send({
      event_type: "approval.requested",
      task_id: task.task_id,
      action: "Send 12 external emails",
      risk: "high",
    });
    const broken = await a.send({ event_type: "task.started", name: "Sync CRM" });
    await a.send({ event_type: "task.failed", task_id: broken.task_id, error: "Timed out" });

    const summary = await desktopSummary(a.ctx);
    expect(summary.organization.name).toBe("Desktop A");
    expect(summary.pendingApprovals).toBe(1);
    expect(summary.approvals[0]).toMatchObject({
      action: "Send 12 external emails",
      risk: "high",
      agentName: "Outreach Writer",
    });
    expect(summary.failedTasks).toEqual([
      expect.objectContaining({
        name: "Sync CRM",
        agentName: "Outreach Writer",
        error: "Timed out",
      }),
    ]);
    expect(summary.agents.total).toBe(1);

    const other = await desktopSummary(b.ctx);
    expect(other.pendingApprovals).toBe(0);
    expect(other.failedTasks).toEqual([]);
  });
});
