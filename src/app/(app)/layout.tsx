import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getOrganization } from "@/features/organizations/server/organization-service";
import { requireOrgContext } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/security/permissions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireOrgContext();
  const org = await getOrganization(ctx);

  return (
    <AppShell user={ctx.user} organizationName={org.name} roleLabel={ROLE_LABELS[ctx.role]}>
      {children}
    </AppShell>
  );
}
