import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ApprovalCard } from "@/features/approvals/components/approval-card";
import {
  APPROVAL_FILTERS,
  APPROVAL_PAGE_SIZE,
  listApprovals,
  pendingApprovalCount,
  type ApprovalFilter,
} from "@/features/approvals/server/approval-service";
import { requireOrgContext } from "@/lib/auth/guards";
import { can } from "@/lib/security/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Approvals" };

const LABEL: Record<ApprovalFilter, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  all: "All",
};

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrgContext();
  const sp = await searchParams;
  const filter = (APPROVAL_FILTERS as readonly string[]).includes(String(sp.status))
    ? (String(sp.status) as ApprovalFilter)
    : "pending";
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ total, rows }, pending] = await Promise.all([
    listApprovals(ctx, { filter, page }),
    pendingApprovalCount(ctx),
  ]);
  const canDecide = can(ctx.role, "approvals:decide");
  const pages = Math.max(1, Math.ceil(total / APPROVAL_PAGE_SIZE));
  const href = (s: string, p = 1) =>
    `/approvals?${new URLSearchParams({ status: s, ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Approvals</h1>
        <p className="mt-1 text-sm text-muted">
          Actions your agents asked a person to approve. Agent permissions marked{" "}
          <strong className="text-foreground">Allowed</strong> or{" "}
          <strong className="text-foreground">Denied</strong> are decided automatically; anything
          marked <strong className="text-foreground">Requires approval</strong> (or unknown) waits
          here.
        </p>
      </div>

      <nav aria-label="Approval status" className="flex flex-wrap gap-2">
        {APPROVAL_FILTERS.map((f) => (
          <Link
            key={f}
            href={href(f)}
            aria-current={f === filter ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              f === filter
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted hover:text-foreground",
            )}
          >
            {LABEL[f]}
            {f === "pending" && pending ? (
              <span className="ml-1.5 rounded-full bg-warning px-1.5 text-[11px] font-semibold text-background">
                {pending}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title={filter === "pending" ? "Nothing waiting for approval" : "No approvals here yet"}
            description="When an agent requests approval (approval.requested in the SDK or Event API), it appears here and the agent waits for your decision."
          />
        </Card>
      ) : (
        <ul className="space-y-3" aria-label={`${LABEL[filter]} approvals`}>
          {rows.map((a) => (
            <li key={a.id}>
              <ApprovalCard a={a} canDecide={canDecide} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Page {page} of {pages} · {total} total
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={href(filter, page - 1)} className={buttonStyles("secondary", "sm")}>
                <ChevronLeft aria-hidden className="size-4" /> Previous
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={href(filter, page + 1)} className={buttonStyles("secondary", "sm")}>
                Next <ChevronRight aria-hidden className="size-4" />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
