import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateOrganizationAction } from "@/features/organizations/actions";
import { OrganizationForm } from "@/features/organizations/components/organization-form";
import { countryOptions, timezoneOptions } from "@/features/organizations/constants";
import { getOrganization } from "@/features/organizations/server/organization-service";
import { requireOrgContext } from "@/lib/auth/guards";
import { can } from "@/lib/security/permissions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireOrgContext();
  const org = await getOrganization(ctx);
  const canEdit = can(ctx.role, "org:update");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted">Manage your organization profile.</p>
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Organization</CardTitle>
            <CardDescription>
              Workspace ID <code className="font-mono text-xs text-foreground">{org.id}</code>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!canEdit ? (
            <p className="mb-4 flex items-center gap-2 rounded-control border border-border bg-raised px-3 py-2 text-sm text-muted">
              <Lock aria-hidden className="size-4" /> Only owners and admins can change organization
              settings.
            </p>
          ) : null}
          <OrganizationForm
            action={updateOrganizationAction}
            countries={countryOptions()}
            timezones={timezoneOptions()}
            defaultValues={{
              name: org.name,
              industry: org.industry,
              companySize: org.companySize,
              country: org.country,
              timezone: org.timezone,
            }}
            submitLabel="Save changes"
            pendingLabel="Saving…"
            readOnly={!canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
