import {
  Activity,
  AlertTriangle,
  Bot,
  CircleDollarSign,
  Clock,
  Coins,
  ListChecks,
  Loader,
  Plus,
} from "lucide-react";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { OnboardingChecklist } from "@/features/dashboard/components/onboarding-checklist";
import { getDashboardOverview } from "@/features/dashboard/server/dashboard-service";
import { requireOrgContext } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Dashboard" };

const KPIS = [
  { label: "Total agents", icon: Bot },
  { label: "Working", icon: Loader },
  { label: "Waiting", icon: Clock },
  { label: "Errors", icon: AlertTriangle },
  { label: "Tasks today", icon: ListChecks },
  { label: "Tokens", icon: Coins },
  { label: "AI cost", icon: CircleDollarSign },
];

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const { greeting, checklist } = await getDashboardOverview(ctx);
  const firstName = ctx.user.name.split(/\s+/)[0];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Your control center is ready. Connect your first agent to start monitoring your AI
          workforce.
        </p>
      </div>

      <section
        aria-label="Workforce KPIs"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7"
      >
        {KPIS.map((k) => (
          <KpiCard key={k.label} label={k.label} icon={k.icon} value="—" caption="No data yet" />
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>AI workforce</CardTitle>
            </CardHeader>
            <EmptyState
              icon={Bot}
              title="Your AI workforce is empty."
              description="Connect an agent you already run — SDK, REST API, webhook or MCP — and AgentOS will track its tasks, tokens and cost."
              action={
                <Button disabled title="Agent connections are coming in the next release">
                  <Plus aria-hidden className="size-4" />
                  Connect Your First Agent
                </Button>
              }
            />
          </Card>
        </div>

        <div className="space-y-6">
          <OnboardingChecklist items={checklist} />
          <Card>
            <CardHeader>
              <CardTitle>Live activity</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <EmptyState
                icon={Activity}
                title="No activity yet"
                description="Agent activity will appear here when your agents start working."
                className="py-8"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
