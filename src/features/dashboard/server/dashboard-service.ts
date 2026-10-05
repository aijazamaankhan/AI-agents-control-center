import "server-only";
import type { OrgContext } from "@/lib/auth/sessions";
import {
  countMembers,
  getOrganization,
} from "@/features/organizations/server/organization-service";

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

/**
 * Onboarding checklist reflecting real state. Items for features that are not
 * built yet are reported as not done — never faked (docs/PRD.md §5).
 */
export async function getOnboardingChecklist(ctx: OrgContext): Promise<ChecklistItem[]> {
  const memberCount = await countMembers(ctx);
  return [
    { key: "company", label: "Company created", done: true },
    { key: "departments", label: "Departments created", done: false },
    { key: "agent", label: "First agent connected", done: false },
    { key: "team", label: "Invite team", done: memberCount > 1 },
    { key: "budget", label: "Configure budget", done: false },
    { key: "integration", label: "Connect integration", done: false },
  ];
}

export function greetingFor(date: Date, timezone: string): string {
  let hour: number;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: timezone,
      }).format(date),
    );
  } catch {
    hour = date.getUTCHours();
  }
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export async function getDashboardOverview(ctx: OrgContext) {
  const [organization, checklist] = await Promise.all([
    getOrganization(ctx),
    getOnboardingChecklist(ctx),
  ]);
  return {
    organization,
    checklist,
    greeting: greetingFor(new Date(), organization.timezone),
  };
}
