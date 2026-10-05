import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { OnboardingDepartments } from "@/features/departments/components/onboarding-departments";
import { countDepartments } from "@/features/departments/server/department-service";
import { OnboardingSteps } from "@/features/organizations/components/onboarding-steps";
import { requireOrgContext } from "@/lib/auth/guards";
import { can } from "@/lib/security/permissions";

export const metadata: Metadata = { title: "Create departments" };

export default async function OnboardingDepartmentsPage() {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "departments:manage")) redirect("/dashboard");
  if ((await countDepartments(ctx)) > 0) redirect("/departments");

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-10">
      <Logo />
      <OnboardingSteps current={1} />
      <div className="mt-8 rounded-[22px] border border-border bg-surface p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-wider text-primary uppercase">Step 2 of 5</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Create your departments</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Departments group your AI agents by the team that owns them. Keep the recommended ones,
          rename or remove them, or add your own — you can change them any time.
        </p>
        <OnboardingDepartments />
      </div>
    </div>
  );
}
