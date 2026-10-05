import { Lock, Monitor, Palette, Shield, User, Building } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChangePasswordForm,
  ProfileForm,
  SignOutOthersButton,
} from "@/features/account/components/account-forms";
import { listSessions } from "@/features/account/server/account-service";
import { relativeTime } from "@/features/agents/format";
import { updateOrganizationAction } from "@/features/organizations/actions";
import { OrganizationForm } from "@/features/organizations/components/organization-form";
import { countryOptions, timezoneOptions } from "@/features/organizations/constants";
import { getOrganization } from "@/features/organizations/server/organization-service";
import { getCurrentSession, requireOrgContext } from "@/lib/auth/guards";
import { can, ROLE_LABELS } from "@/lib/security/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { key: "organization", label: "Organization", icon: Building },
  { key: "profile", label: "Profile", icon: User },
  { key: "security", label: "Security", icon: Shield },
  { key: "appearance", label: "Appearance", icon: Palette },
] as const;
type Tab = (typeof TABS)[number]["key"];

function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireOrgContext();
  const session = (await getCurrentSession())!;
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === raw) ? (raw as Tab) : "organization";
  const org = await getOrganization(ctx);
  const canEdit = can(ctx.role, "org:update");
  const sessions = tab === "security" ? await listSessions(session) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          {org.name} · you are <strong className="text-foreground">{ROLE_LABELS[ctx.role]}</strong>
        </p>
      </div>

      <nav
        aria-label="Settings sections"
        className="scroller-x -mx-1 flex gap-1 border-b border-border px-1"
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <Link
            key={key}
            href={key === "organization" ? "/settings" : `/settings?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap",
              tab === key
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-4" /> {label}
          </Link>
        ))}
      </nav>

      {tab === "organization" ? (
        <Card className="rounded-[22px]">
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
                <Lock aria-hidden className="size-4" /> Only owners and admins can change
                organization settings.
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
      ) : null}

      {tab === "profile" ? (
        <Card className="rounded-[22px]">
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm name={session.user.name} email={session.user.email} />
          </CardContent>
        </Card>
      ) : null}

      {tab === "security" ? (
        <div className="space-y-6">
          <Card className="rounded-[22px]">
            <CardHeader>
              <div>
                <CardTitle>Change password</CardTitle>
                <CardDescription>
                  Changing your password signs you out on every other device.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
          <Card className="rounded-[22px]">
            <CardHeader>
              <div>
                <CardTitle>Active sessions</CardTitle>
                <CardDescription>Devices where you&apos;re signed in.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul
                className="divide-y divide-border rounded-control border border-border"
                aria-label="Active sessions"
              >
                {sessions.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <Monitor aria-hidden className="size-4 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-foreground">
                        {describeAgent(s.userAgent)}
                        {s.current ? (
                          <span className="ml-2 text-xs font-medium text-primary">This device</span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-muted">
                        Signed in {relativeTime(s.createdAt)}
                        {s.ipAddress ? ` · ${s.ipAddress}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <SignOutOthersButton />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "appearance" ? (
        <Card className="rounded-[22px]">
          <CardHeader>
            <div>
              <CardTitle>Theme</CardTitle>
              <CardDescription>
                Choose light, dark, or follow your system setting. Saved on this device.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ThemeToggle showLabels />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
