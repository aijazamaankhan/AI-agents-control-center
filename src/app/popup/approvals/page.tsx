import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { ApprovalCard } from "@/features/approvals/components/approval-card";
import { listApprovals } from "@/features/approvals/server/approval-service";
import { requireOrgContext } from "@/lib/auth/guards";
import { can } from "@/lib/security/permissions";

export const metadata: Metadata = { title: "Pending approvals" };

/** Compact pending-approvals list for the desktop app's approval pop-up. */
export default async function ApprovalsPopupPage() {
  const ctx = await requireOrgContext();
  const { total, rows } = await listApprovals(ctx, { filter: "pending" });
  const canDecide = can(ctx.role, "approvals:decide");

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold text-foreground">
          Pending approvals <span className="text-muted">({total})</span>
        </h1>
        <Link href="/approvals" target="_blank" className="text-xs text-primary hover:underline">
          Open in AgentOS
        </Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="All caught up"
          description="Nothing is waiting for approval."
          className="py-8"
        />
      ) : (
        <ul className="space-y-3" aria-label="Pending approvals">
          {rows.map((a) => (
            <li key={a.id}>
              <ApprovalCard a={a} canDecide={canDecide} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
