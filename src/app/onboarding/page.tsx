import { Check } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { createOrganizationAction } from "@/features/organizations/actions";
import { OrganizationForm } from "@/features/organizations/components/organization-form";
import { countryOptions, timezoneOptions } from "@/features/organizations/constants";
import { getCurrentOrgContext, requireSession } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Set up your company" };

const STEPS = ["Create company", "Departments", "Connect agent", "Invite team", "Dashboard"];

export default async function OnboardingPage() {
  const session = await requireSession();
  // Phase 1: one onboarding pass. Users who already belong to an org go to the dashboard.
  if (await getCurrentOrgContext()) redirect("/dashboard");

  const firstName = session.user.name.split(/\s+/)[0];

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-10">
      <Logo />
      <ol aria-label="Onboarding steps" className="mt-10 flex flex-wrap gap-x-5 gap-y-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === 0 ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 text-xs",
              i === 0 ? "text-foreground" : "text-muted",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                i === 0 ? "border-primary bg-primary text-white" : "border-border",
              )}
            >
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

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
