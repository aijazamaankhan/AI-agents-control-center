import { Bot, ListChecks } from "lucide-react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/features/agents/format";
import type { ApprovalRow } from "../server/approval-service";
import { DecideForm } from "./decide-form";

const RISK: Record<string, BadgeTone> = { LOW: "neutral", MEDIUM: "warning", HIGH: "error" };
const STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  PENDING: { tone: "warning", label: "Pending" },
  APPROVED: { tone: "success", label: "Approved" },
  REJECTED: { tone: "error", label: "Rejected" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
};

export function ApprovalCard({ a, canDecide }: { a: ApprovalRow; canDecide: boolean }) {
  const status = STATUS[a.status] ?? STATUS.PENDING!;
  return (
    <Card className="rounded-[18px] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={RISK[a.risk] ?? "neutral"}>{a.risk.toLowerCase()} risk</Badge>
            {a.capabilityKey ? (
              <span className="font-mono text-[11px] text-muted">{a.capabilityKey}</span>
            ) : null}
          </div>
          <h2 className="mt-2 text-base font-semibold text-foreground">{a.action}</h2>
          {a.reason ? <p className="mt-1 text-sm text-muted">{a.reason}</p> : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <Link
              href={`/agents/${a.agentId}`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Bot aria-hidden className="size-3.5" /> {a.agentName}
              {a.departmentName ? ` · ${a.departmentName}` : ""}
            </Link>
            {a.taskId ? (
              <Link
                href={`/tasks/${a.taskId}`}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <ListChecks aria-hidden className="size-3.5" /> {a.taskName ?? a.taskId}
              </Link>
            ) : null}
            <span>Requested {relativeTime(a.requestedAt).toLowerCase()}</span>
          </p>
        </div>
      </div>
      {a.status === "PENDING" ? (
        canDecide ? (
          <div className="mt-4 border-t border-border pt-4">
            <DecideForm id={a.id} action={a.action} />
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">
            Waiting for an owner, admin or manager to decide.
          </p>
        )
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
          {a.decisionSource === "POLICY"
            ? "Decided automatically by the agent's permissions"
            : a.decisionSource === "SYSTEM"
              ? "Closed automatically"
              : `${status.label} by ${a.decidedByName ?? "a former member"}`}
          {a.decidedAt ? ` · ${relativeTime(a.decidedAt).toLowerCase()}` : ""}
          {a.decisionNote ? (
            <span className="mt-1 block text-foreground">“{a.decisionNote}”</span>
          ) : null}
        </p>
      )}
    </Card>
  );
}
