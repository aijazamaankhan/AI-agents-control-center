import {
  Activity,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarCheck,
  Check,
  ChevronDown,
  CircleDollarSign,
  Coins,
  Eye,
  FileClock,
  Fingerprint,
  KeyRound,
  Laptop,
  Lock,
  MessageSquareText,
  MonitorSmartphone,
  Plug,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  TriangleAlert,
  UserCheck,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { BookDemoTrigger } from "@/features/inquiries/components/inquiry-dialogs";
import { CodeSample } from "@/features/marketing/components/code-sample";
import { SiteFooter } from "@/features/marketing/components/site-footer";
import { SiteHeader } from "@/features/marketing/components/site-header";
import { WorkforceMap } from "@/features/workforce/components/workforce-map";
import { SAMPLE_WORKFORCE } from "@/features/workforce/sample-data";

const WORKS_WITH = [
  "Anthropic",
  "OpenAI",
  "Google Gemini",
  "LangGraph",
  "CrewAI",
  "AutoGen",
  "n8n",
  "MCP",
  "Python",
  "Node.js",
  "REST APIs",
  "Webhooks",
];

const QUESTIONS: { icon: LucideIcon; q: string; accent: string }[] = [
  { icon: Bot, q: "How many agents are working right now?", accent: "var(--color-primary)" },
  { icon: Activity, q: "What task is each agent performing?", accent: "var(--color-cyan)" },
  { icon: Coins, q: "How many tokens did we use today?", accent: "var(--color-purple)" },
  { icon: CircleDollarSign, q: "Which department spends the most?", accent: "var(--color-lime)" },
  { icon: TriangleAlert, q: "Which agent is failing — and why?", accent: "var(--color-error)" },
  { icon: UserCheck, q: "What needs my approval?", accent: "var(--color-warning)" },
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
  {
    icon: UserCheck,
    title: "Review",
    body: "Risky actions wait for a human to approve or reject.",
  },
  {
    icon: SlidersHorizontal,
    title: "Control",
    body: "Budgets, alerts and permissions enforced server-side.",
  },
];

const FEATURES: { icon: LucideIcon; title: string; body: string; accent: string }[] = [
  {
    icon: Building2,
    title: "Departments",
    body: "Organize every agent by the team that owns it — unlimited, your own names.",
    accent: "var(--color-cyan)",
  },
  {
    icon: Activity,
    title: "Live activity",
    body: "A real-time stream of tasks, model calls and tool calls as they happen.",
    accent: "var(--color-primary)",
  },
  {
    icon: Workflow,
    title: "Execution traces",
    body: "Every step of every task, expandable, with latency, tokens and cost.",
    accent: "var(--color-purple)",
  },
  {
    icon: Coins,
    title: "Token accounting",
    body: "Input, output and cached tokens per agent, model, provider and day.",
    accent: "var(--color-lime)",
  },
  {
    icon: CircleDollarSign,
    title: "Cost tracking",
    body: "Versioned pricing so historical costs stay auditable when prices change.",
    accent: "var(--color-lime)",
  },
  {
    icon: UserCheck,
    title: "Human approvals",
    body: "Payments, refunds, external emails and publishing wait for a person.",
    accent: "var(--color-warning)",
  },
  {
    icon: Bell,
    title: "Budgets & alerts",
    body: "Daily, weekly, monthly budgets with 50/75/90/100% thresholds.",
    accent: "var(--color-orange)",
  },
  {
    icon: TriangleAlert,
    title: "Anomaly detection",
    body: "Token spikes, cost jumps, repeated failures and inactive agents.",
    accent: "var(--color-error)",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Performance, throughput, failure rate and spend — with CSV export.",
    accent: "var(--color-cyan)",
  },
  {
    icon: FileClock,
    title: "Audit log",
    body: "Who changed what, when — every approval, permission and credential.",
    accent: "var(--color-purple)",
  },
  {
    icon: MonitorSmartphone,
    title: "Web, desktop & mobile",
    body: "Approve from your phone, get desktop notifications, one source of truth.",
    accent: "var(--color-pink)",
  },
  {
    icon: MessageSquareText,
    title: "AI assistant",
    body: "Ask “why did costs rise yesterday?” — answered from your real data only.",
    accent: "var(--color-primary)",
  },
];

const SECURITY: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Fingerprint,
    title: "Tenant isolation",
    body: "Every query is scoped to your organization server-side. Never by the browser.",
  },
  {
    icon: KeyRound,
    title: "Encrypted credentials",
    body: "Agent credentials are encrypted at rest; API keys are stored only as hashes.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Owner, Admin, Manager, Member and Viewer — enforced on the server.",
  },
  {
    icon: Lock,
    title: "Privacy by default",
    body: "Prompts, tool arguments and secrets aren't stored unless you opt in.",
  },
];

const FAQ = [
  {
    q: "Is AgentOS an agent builder?",
    a: "No. AgentOS is the control plane and observability layer for agents you already have — built with OpenAI, Anthropic, Google, LangGraph, CrewAI, AutoGen, n8n, MCP or your own code.",
  },
  {
    q: "How do my agents connect?",
    a: "With the AgentOS SDK, a REST endpoint, webhooks, MCP or a custom integration. Each agent gets a permanent ID and reports tasks, model calls and tool calls.",
  },
  {
    q: "How are token costs calculated?",
    a: "From a versioned pricing table per provider and model. Every cost record stores its pricing version, so historical spend stays auditable when prices change.",
  },
  {
    q: "Can a duplicated event double-count my costs?",
    a: "No. Every event carries an idempotency key; repeats return the original event and never add tokens, cost or activity twice.",
  },
  {
    q: "Do you store our prompts?",
    a: "Not by default. Prompts, tool arguments, secrets and customer records are only stored if your organization explicitly enables it, with retention settings.",
  },
  {
    q: "Is it free to start?",
    a: "Yes — create your company, set up departments and explore the workforce map for free. Book a demo if you'd like a guided walkthrough.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
        {title}
      </h2>
      {body ? <p className="mt-4 text-base text-pretty text-muted">{body}</p> : null}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--color-primary)_16%,transparent),transparent)]"
      />
      <SiteHeader />

      <main className="relative flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-16 pb-10 text-center sm:pt-24">
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
            <BookDemoTrigger className={buttonStyles("secondary", "lg", "w-full sm:w-auto")}>
              <CalendarCheck aria-hidden className="size-4" /> Book Demo
            </BookDemoTrigger>
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted">
            {[
              "Free to start",
              "Works with the agents you already run",
              "Data isolated per company",
            ].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check aria-hidden className="size-3.5 text-primary" /> {t}
              </li>
            ))}
          </ul>
        </section>

        {/* Works with */}
        <section aria-label="Works with" className="mx-auto max-w-6xl px-6 pb-12">
          <p className="text-center text-xs tracking-[0.2em] text-muted uppercase">
            Works with your stack
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {WORKS_WITH.map((w) => (
              <li
                key={w}
                className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {w}
              </li>
            ))}
          </ul>
        </section>

        {/* Product preview */}
        <section
          id="product"
          aria-label="Product preview"
          className="mx-auto max-w-7xl scroll-mt-20 px-4 pb-24 sm:px-6"
        >
          <div className="rounded-[26px] border border-border bg-background/60 p-2 shadow-[0_40px_120px_-40px_color-mix(in_oklab,var(--color-primary)_35%,transparent)]">
            <WorkforceMap departments={SAMPLE_WORKFORCE} sample variant="landing" />
          </div>
        </section>

        {/* Questions */}
        <section aria-labelledby="answers" className="mx-auto max-w-6xl px-6 pb-24">
          <SectionHeading
            eyebrow="Complete visibility"
            title="Answers every AI-first company needs"
            body="Open AgentOS and know instantly what your AI workforce is doing, what it costs and what needs you."
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUESTIONS.map(({ icon: Icon, q, accent }) => (
              <li
                key={q}
                className="flex items-center gap-4 rounded-[20px] border border-border bg-surface p-5"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `color-mix(in oklab, ${accent} 14%, transparent)`,
                    color: accent,
                  }}
                >
                  <Icon aria-hidden className="size-5" />
                </span>
                <p className="text-sm font-medium text-foreground">{q}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          aria-label="How it works"
          className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-24"
        >
          <SectionHeading
            eyebrow="How it works"
            title="From scattered agents to one control center"
          />
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* Features */}
        <section
          id="features"
          aria-label="Features"
          className="mx-auto max-w-7xl scroll-mt-20 px-6 pb-24"
        >
          <SectionHeading
            eyebrow="Features"
            title="Everything to run an AI workforce"
            body="Datadog-grade observability, Linear-grade clarity and Stripe-grade usage accounting — for AI agents."
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body, accent }) => (
              <li
                key={title}
                className="rounded-[20px] border border-border bg-surface p-5 transition-colors hover:border-border-strong"
              >
                <Icon aria-hidden className="size-5" style={{ color: accent }} />
                <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Control: approvals + budget (illustrative) */}
        <section aria-label="Approvals and budgets" className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
                Stay in control
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Agents act. Humans decide.
              </h2>
              <p className="mt-4 text-muted">
                Define what each agent may do, what it must never do, and what needs approval first.
                Set budgets per company and get alerted before spend gets away from you — on the
                web, desktop or your phone.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {[
                  "Allowed, denied and approval-required actions per agent",
                  "Approve or reject in one tap — every decision audited",
                  "Budget thresholds at 50%, 75%, 90% and 100%",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-foreground">
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4" aria-label="Example widgets">
              <div className="rounded-[22px] border border-warning/30 bg-surface p-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-warning">Approval requested</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-muted">
                    Example
                  </span>
                </div>
                <p className="mt-3 text-base font-semibold text-foreground">Issue $129 refund</p>
                <p className="mt-1 text-sm text-muted">
                  Refund Agent · Customer Support · Risk: Medium
                </p>
                <div className="mt-4 flex gap-2">
                  <span className={buttonStyles("primary", "sm", "pointer-events-none")}>
                    <Check aria-hidden className="size-4" /> Approve
                  </span>
                  <span className={buttonStyles("secondary", "sm", "pointer-events-none")}>
                    <X aria-hidden className="size-4" /> Reject
                  </span>
                </div>
              </div>
              <div className="rounded-[22px] border border-border bg-surface p-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted uppercase">Monthly AI budget</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-muted">
                    Example
                  </span>
                </div>
                <p className="mt-3 font-display text-5xl leading-none font-medium text-foreground">
                  $642<span className="text-2xl text-muted"> / $1,000</span>
                </p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-raised">
                  <div className="h-full w-[64.2%] rounded-full bg-lime shadow-[0_0_20px_var(--color-lime)]" />
                </div>
                <p className="mt-2 text-xs text-muted">64.2% used · next alert at 75%</p>
              </div>
            </div>
          </div>
        </section>

        {/* Developers */}
        <section
          id="developers"
          aria-label="Developers"
          className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-24"
        >
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">
                For developers
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                A few lines to report everything
              </h2>
              <p className="mt-4 text-muted">
                The AgentOS SDK attaches agent, task and execution IDs, timestamps, tokens, latency
                and cost metadata automatically. Or post events straight to the Event API.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm">
                {[
                  "Idempotent events — duplicates never double-count",
                  "Heartbeats keep agent status live",
                  "Works from any language or framework over HTTPS",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-foreground">
                    <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <CodeSample />
          </div>
        </section>

        {/* Security */}
        <section
          id="security"
          aria-label="Security"
          className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-24"
        >
          <SectionHeading eyebrow="Security" title="Built for companies that take data seriously" />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECURITY.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-[20px] border border-border bg-surface p-5">
                <span className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Platforms */}
        <section aria-label="Platforms" className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Laptop, title: "Web", body: "The full control center in your browser." },
              {
                icon: MonitorSmartphone,
                title: "Desktop",
                body: "Tray status, notifications and approval pop-ups.",
              },
              {
                icon: Smartphone,
                title: "Mobile",
                body: "Approvals, alerts and live status on the go.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="flex items-center gap-4 rounded-[20px] border border-border bg-surface p-5"
              >
                <Icon aria-hidden className="size-8 shrink-0 text-cyan" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-sm text-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          aria-label="Frequently asked questions"
          className="mx-auto max-w-3xl scroll-mt-20 px-6 pb-24"
        >
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <div className="mt-10 space-y-3">
            {FAQ.map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-[16px] border border-border bg-surface px-5 py-4 open:border-border-strong"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section aria-label="Get started" className="mx-auto max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-[28px] border border-primary/30 bg-surface px-6 py-14 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,color-mix(in_oklab,var(--color-primary)_18%,transparent),transparent)]"
            />
            <div aria-hidden className="bg-dots pointer-events-none absolute inset-0 opacity-50" />
            <h2 className="relative text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Put your AI workforce under one roof.
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-muted">
              Create your company in under a minute. Connect your first agent when you&apos;re
              ready.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className={buttonStyles("primary", "lg", "w-full sm:w-auto")}>
                Start Free <ArrowRight aria-hidden className="size-4" />
              </Link>
              <BookDemoTrigger className={buttonStyles("secondary", "lg", "w-full sm:w-auto")}>
                <CalendarCheck aria-hidden className="size-4" /> Book Demo
              </BookDemoTrigger>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
