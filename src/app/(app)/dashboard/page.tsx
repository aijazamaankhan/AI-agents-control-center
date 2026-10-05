import {
  AlertTriangle,
  Bot,
  CircleDollarSign,
  Clock,
  Coins,
  ListChecks,
  Loader,
  Plus,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui/button";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { OnboardingChecklist } from "@/features/dashboard/components/onboarding-checklist";
import { getDashboardOverview } from "@/features/dashboard/server/dashboard-service";
import { WorkforceMap } from "@/features/workforce/components/workforce-map";
import { SAMPLE_WORKFORCE } from "@/features/workforce/sample-data";
import { requireOrgContext } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Dashboard" };

// Real KPIs: no agents are connected yet, so every count is genuinely zero.
const KPIS = [
  { label: "Total agents", icon: Bot, value: "0", accent: "var(--color-foreground)" },
  { label: "Working", icon: Loader, value: "0", accent: "var(--color-primary)" },
  { label: "Waiting", icon: Clock, value: "0", accent: "var(--color-warning)" },
  { label: "Errors", icon: AlertTriangle, value: "0", accent: "var(--color-error)" },
  { label: "Tasks today", icon: ListChecks, value: "0", accent: "var(--color-cyan)" },
  { label: "Tokens", icon: Coins, value: "0", accent: "var(--color-purple)" },
  { label: "AI cost", icon: CircleDollarSign, value: "$0.00", accent: "var(--color-lime)" },
];

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const { greeting, checklist } = await getDashboardOverview(ctx);
  const firstName = ctx.user.name.split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Your control center is ready. Connect your first agent to start monitoring your AI
            workforce.
          </p>
        </div>
        <Link href="/help" className={buttonStyles("secondary", "sm")}>
          <Sparkles aria-hidden className="size-4 text-primary" /> How AgentOS works
        </Link>
      </div>

      <section
        aria-label="Workforce KPIs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7"
      >
        {KPIS.map((k) => (
          <KpiCard key={k.label} {...k} caption="No agents connected" />
        ))}
      </section>

      <WorkforceMap departments={SAMPLE_WORKFORCE} sample />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-[22px] border border-border bg-surface p-6 lg:col-span-2">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl"
          />
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            Your workforce
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            Your AI workforce is empty.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            The map above shows a simulated sample. Connect an agent you already run — SDK, REST
            API, webhook or MCP — and AgentOS will track its tasks, tokens and cost here in real
            time.
          </p>
          <ol className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {["Connect", "Observe", "Review", "Control"].map((step, i) => (
              <li key={step} className="rounded-card border border-border bg-raised/60 p-3">
                <span className="font-display text-2xl font-medium text-primary">0{i + 1}</span>
                <p className="mt-1 text-sm font-medium text-foreground">{step}</p>
              </li>
            ))}
          </ol>
          <Button className="mt-6" disabled title="Agent connections are coming in Phase 3">
            <Plus aria-hidden className="size-4" />
            Connect Your First Agent
          </Button>
        </div>
        <OnboardingChecklist items={checklist} />
      </div>
    </div>
  );
}
