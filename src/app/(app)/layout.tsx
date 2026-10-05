import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { pendingApprovalCount } from "@/features/approvals/server/approval-service";
import { getOrganization } from "@/features/organizations/server/organization-service";
import { requireOrgContext } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/security/permissions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgContext();
  const [org, pending] = await Promise.all([getOrganization(ctx), pendingApprovalCount(ctx)]);

  return (
    <AppShell
      user={ctx.user}
      organizationName={org.name}
      roleLabel={ROLE_LABELS[ctx.role]}
      badges={{ "/approvals": pending }}
    >
      {children}
    </AppShell>
  );
}
