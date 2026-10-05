import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST as postEvent } from "@/app/api/agent-events/route";
import { GET as getAgentApproval } from "@/app/api/agent/approvals/[id]/route";
import { agentSchema } from "@/features/agents/schemas";
import { createAgent } from "@/features/agents/server/agent-service";
import {
  decideApproval,
  listApprovals,
  pendingApprovalCount,
} from "@/features/approvals/server/approval-service";
import { createDepartment } from "@/features/departments/server/department-service";
import { db } from "@/lib/db/client";
import { createTenant } from "../support/factories";

async function setup(name = "Acme") {
  const t = await createTenant(name);
  const dep = await createDepartment(t.ctx, { name: "Sales", description: "" });
  const { id, apiKey } = await createAgent(
    t.ctx,
    agentSchema.parse({
      name: "Outreach Writer",
      departmentId: dep.id,
      provider: "OpenAI",
      model: "GPT-5",
      connectionType: "SDK",
      capabilities: JSON.stringify([
        { label: "Send external email", rule: "APPROVAL_REQUIRED" },
        { label: "Read CRM", rule: "ALLOWED" },
        { label: "Make payments", rule: "DENIED" },
      ]),
    }),
  );
  return { ...t, dep, agentId: id, apiKey };
}

async function send(apiKey: string, body: unknown, key = randomUUID()) {
  const res = await postEvent(
    new Request("http://localhost/api/agent-events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, data: (await res.json()).data };
}

async function poll(apiKey: string, id: string) {
  const res = await getAgentApproval(
    new Request(`http://localhost/api/agent/approvals/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
    { params: Promise.resolve({ id }) },
  );
  return { status: res.status, data: (await res.json()).data };
}

describe("approvals", () => {
  it("pauses the task until a person approves, then resumes task and agent", async () => {
    const { ctx, apiKey, agentId } = await setup();
    const { data: task } = await send(apiKey, { event_type: "task.started", name: "Outreach" });

    const key = randomUUID();
    const req = await send(
      apiKey,
      {
        event_type: "approval.requested",
        task_id: task.task_id,
        action: "Send 12 external emails",
        capability: "send_external_email",
        reason: "Follow-ups",
        risk: "high",
      },
      key,
    );
    expect(req.status).toBe(201);
    expect(req.data.approval_status).toBe("pending");
    // A retried request is the same approval, not a second one.
    const retry = await send(
      apiKey,
      {
        event_type: "approval.requested",
        task_id: task.task_id,
        action: "Send 12 external emails",
        capability: "send_external_email",
        reason: "Follow-ups",
        risk: "high",
      },
      key,
    );
    expect(retry.data).toMatchObject({ duplicate: true, approval_id: req.data.approval_id });

    expect((await db.task.findUniqueOrThrow({ where: { id: task.task_id } })).status).toBe(
      "WAITING",
    );
    expect((await db.agent.findUniqueOrThrow({ where: { id: agentId } })).status).toBe("WAITING");
    expect(await pendingApprovalCount(ctx)).toBe(1);
    expect((await poll(apiKey, req.data.approval_id)).data.status).toBe("pending");

    const listed = await listApprovals(ctx, { filter: "pending" });
    expect(listed.rows[0]).toMatchObject({
      action: "Send 12 external emails",
      risk: "HIGH",
      capabilityKey: "send_external_email",
      agentName: "Outreach Writer",
      taskName: "Outreach",
    });

    await decideApproval(ctx, req.data.approval_id, "APPROVED", "Existing customers only");
    const polled = await poll(apiKey, req.data.approval_id);
    expect(polled.data).toMatchObject({
      status: "approved",
      decision_source: "human",
      decision_note: "Existing customers only",
    });
    expect((await db.task.findUniqueOrThrow({ where: { id: task.task_id } })).status).toBe(
      "RUNNING",
    );
    expect((await db.agent.findUniqueOrThrow({ where: { id: agentId } })).status).toBe("WORKING");

    // The decision is in the task trace and the audit log; deciding twice is refused.
    const decided = await db.executionEvent.findFirstOrThrow({
      where: { taskId: task.task_id, type: "APPROVAL_DECIDED" },
    });
    expect(decided.summary).toContain("Approved by");
    expect(
      await db.auditLog.count({
        where: { organizationId: ctx.organizationId, action: "approval.approved" },
      }),
    ).toBe(1);
    await expect(decideApproval(ctx, req.data.approval_id, "REJECTED", "")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("lets the agent's permission rules decide instantly (Allowed / Denied)", async () => {
    const { apiKey } = await setup();
    const { data: task } = await send(apiKey, { event_type: "task.started", name: "Sync" });

    const allowed = await send(apiKey, {
      event_type: "approval.requested",
      task_id: task.task_id,
      action: "Read CRM",
    });
    expect(allowed.data.approval_status).toBe("approved");
    const denied = await send(apiKey, {
      event_type: "approval.requested",
      task_id: task.task_id,
      action: "Pay vendor invoice",
      capability: "make_payments",
    });
    expect(denied.data.approval_status).toBe("rejected");
    expect((await poll(apiKey, denied.data.approval_id)).data.decision_source).toBe("policy");
    // Neither paused the task.
    expect((await db.task.findUniqueOrThrow({ where: { id: task.task_id } })).status).toBe(
      "RUNNING",
    );
  });

  it("keeps the agent waiting while a human decision is still pending", async () => {
    const { apiKey, agentId } = await setup();
    const { data: task } = await send(apiKey, { event_type: "task.started", name: "Outreach" });
    await send(apiKey, {
      event_type: "approval.requested",
      task_id: task.task_id,
      action: "Send external email",
    });
    const auto = await send(apiKey, {
      event_type: "approval.requested",
      task_id: task.task_id,
      action: "Make payments",
    });
    expect(auto.data.approval_status).toBe("rejected");
    expect((await db.agent.findUniqueOrThrow({ where: { id: agentId } })).status).toBe("WAITING");
    expect((await db.task.findUniqueOrThrow({ where: { id: task.task_id } })).status).toBe(
      "WAITING",
    );
  });

  it("cancels undecided approvals when the task ends", async () => {
    const { apiKey, ctx } = await setup();
    const { data: task } = await send(apiKey, { event_type: "task.started", name: "Outreach" });
    const req = await send(apiKey, {
      event_type: "approval.requested",
      task_id: task.task_id,
      action: "Something new",
    });
    expect(req.data.approval_status).toBe("pending");
    await send(apiKey, { event_type: "task.cancelled", task_id: task.task_id });
    expect((await poll(apiKey, req.data.approval_id)).data.status).toBe("cancelled");
    expect(await pendingApprovalCount(ctx)).toBe(0);
  });

  it("is tenant- and role-scoped", async () => {
    const a = await setup("Tenant A");
    const b = await setup("Tenant B");
    const req = await send(a.apiKey, {
      event_type: "approval.requested",
      action: "Send external email",
    });
    // Other tenant's people and other agents can't see or decide it.
    await expect(decideApproval(b.ctx, req.data.approval_id, "APPROVED", "")).rejects.toMatchObject(
      { code: "RESOURCE_NOT_FOUND" },
    );
    expect((await poll(b.apiKey, req.data.approval_id)).status).toBe(404);
    expect((await listApprovals(b.ctx)).total).toBe(0);
    // Viewers can't decide.
    await expect(
      decideApproval({ ...a.ctx, role: "VIEWER" }, req.data.approval_id, "APPROVED", ""),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
