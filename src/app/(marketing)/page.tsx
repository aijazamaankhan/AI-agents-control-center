import {
  Activity,
  ArrowRight,
  Building2,
  CircleDollarSign,
  Eye,
  Plug,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonStyles } from "@/components/ui/button";
import { WorkforceMap } from "@/features/workforce/components/workforce-map";
import { SAMPLE_WORKFORCE } from "@/features/workforce/sample-data";

const FEATURES = [
  {
    icon: Building2,
    title: "Organized by department",
    body: "Every agent your company runs, grouped by the team that owns it.",
    accent: "var(--color-cyan)",
  },
  {
    icon: Activity,
    title: "Every task, traced",
    body: "Live activity and full execution traces: model calls, tool calls, results.",
    accent: "var(--color-primary)",
  },
  {
    icon: CircleDollarSign,
    title: "Tokens & cost, accounted",
    body: "Input, output and cached tokens priced per model, agent and department.",
    accent: "var(--color-lime)",
  },
  {
    icon: ShieldCheck,
    title: "Humans in control",
    body: "Approvals for risky actions, budgets, alerts and a complete audit log.",
    accent: "var(--color-orange)",
  },
];

const STEPS = [
  {
    icon: Plug,
    title: "Connect",
    body: "SDK, REST, webhook or MCP — keep the agents you already run.",
  },
  {
    icon: Eye,
    title: "Observe",
    body: "Live status, traces, tokens and cost per agent and department.",
  },
  { icon: UserCheck, title: "Review", body: "Risky actions wait for a human approve or reject." },
  {
    icon: SlidersHorizontal,
    title: "Control",
    body: "Budgets, alerts and permissions enforced server-side.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--color-primary)_16%,transparent),transparent)]"
      />
      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
        <Logo />
        <Link href="/login" className={buttonStyles("ghost", "sm")}>
          Sign in
        </Link>
      </header>

      <main className="relative flex-1">
        <section className="mx-auto max-w-4xl px-6 pt-16 pb-12 text-center sm:pt-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="size-1.5 animate-blink rounded-full bg-primary" /> AI workforce control
            plane
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-6xl">
            Your AI workforce.
            <br />
            <span className="text-glow text-primary">One control center.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-pretty text-muted sm:text-lg">
            Connect your AI agents, organize them by department, monitor every task, understand
            token usage and control AI costs from one place.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={buttonStyles("primary", "lg", "w-full sm:w-auto")}>
              Start Free <ArrowRight aria-hidden className="size-4" />
            </Link>
            <a
              href="mailto:sales@agentos.dev?subject=AgentOS%20demo"
              className={buttonStyles("secondary", "lg", "w-full sm:w-auto")}
            >
              Book Demo
            </a>
          </div>
        </section>

        <section aria-label="Product preview" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <div className="rounded-[26px] border border-border bg-background/60 p-2 shadow-[0_40px_120px_-40px_color-mix(in_oklab,var(--color-primary)_35%,transparent)]">
            <WorkforceMap departments={SAMPLE_WORKFORCE} sample variant="landing" />
          </div>
        </section>

        <section aria-label="How it works" className="mx-auto max-w-6xl px-6 pb-20">
          <h2 className="text-center text-xs font-semibold tracking-[0.25em] text-muted uppercase">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="relative rounded-[20px] border border-border bg-surface p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="font-display text-3xl font-medium text-border-strong">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-label="Features"
          className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map(({ icon: Icon, title, body, accent }) => (
            <div key={title} className="rounded-[20px] border border-border bg-surface p-5">
              <Icon aria-hidden className="size-5" style={{ color: accent }} />
              <h2 className="mt-4 text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-1.5 text-sm text-muted">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative border-t border-border py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} AgentOS
      </footer>
    </div>
  );
}
