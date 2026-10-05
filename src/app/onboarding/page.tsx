import { Check } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { createOrganizationAction } from "@/features/organizations/actions";
import { OnboardingSteps } from "@/features/organizations/components/onboarding-steps";
import { OrganizationForm } from "@/features/organizations/components/organization-form";
import { countryOptions, timezoneOptions } from "@/features/organizations/constants";
import { getCurrentOrgContext, requireSession } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Set up your company" };

export default async function OnboardingPage() {
  const session = await requireSession();
  // Phase 1: one onboarding pass. Users who already belong to an org go to the dashboard.
  if (await getCurrentOrgContext()) redirect("/dashboard");

  const firstName = session.user.name.split(/\s+/)[0];

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-10">
      <Logo />
      <OnboardingSteps current={0} />

      <div className="mt-8 rounded-card border border-border bg-surface p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-wider text-primary uppercase">Step 1 of 5</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Welcome, {firstName}. Create your company.
        </h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Your company is an isolated workspace for your agents, departments, usage and team.
        </p>
        <OrganizationForm
          action={createOrganizationAction}
          countries={countryOptions()}
          timezones={timezoneOptions()}
          submitLabel="Create company"
          pendingLabel="Creating…"
        />
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Check aria-hidden className="size-3.5 text-success" /> You can change these details later
        in Settings.
      </p>
    </div>
  );
}
