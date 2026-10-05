import { ShieldOff } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { STUDIO } from "@/config/site";
import { logoutAction } from "@/features/auth/actions";
import { getCurrentSession } from "@/lib/auth/guards";
import { resolveOrgContext } from "@/lib/auth/sessions";

export const metadata: Metadata = { title: "Account suspended" };

export default async function SuspendedPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const ctx = await resolveOrgContext(session);
  if (!ctx?.organizationSuspended) redirect("/dashboard");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo />
      <div className="mt-8 max-w-md rounded-[22px] border border-warning/30 bg-surface p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-warning/15 text-warning">
          <ShieldOff aria-hidden className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-foreground">This workspace is suspended</h1>
        <p className="mt-2 text-sm text-muted">
          Access to your organization and its agents is paused. Please contact {STUDIO.name} at{" "}
          <a href={`mailto:${STUDIO.email}`} className="text-primary hover:underline">
            {STUDIO.email}
          </a>
          .
        </p>
        <form action={logoutAction} className="mt-6">
          <button type="submit" className="text-sm text-muted hover:text-foreground">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
