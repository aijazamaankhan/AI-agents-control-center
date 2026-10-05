import { Activity, Building2, CircleDollarSign, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { buttonStyles } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Building2,
    title: "Organized by department",
    body: "See every agent your company runs, grouped by the team that owns it.",
  },
  {
    icon: Activity,
    title: "Every task, traced",
    body: "Live activity and full execution traces: model calls, tool calls, results.",
  },
  {
    icon: CircleDollarSign,
    title: "Tokens & cost, accounted",
    body: "Input, output and cached tokens priced per model, per agent, per department.",
  },
  {
    icon: ShieldCheck,
    title: "Humans in control",
    body: "Approvals for risky actions, budgets, alerts and a complete audit log.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <Link href="/login" className={buttonStyles("ghost", "sm")}>
          Sign in
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center sm:pt-28">
          <p className="text-xs font-semibold tracking-[0.3em] text-primary">AGENTOS</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-6xl">
            Your AI workforce. One control center.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-pretty text-muted sm:text-lg">
            Connect your AI agents, organize them by department, monitor every task, understand
            token usage and control AI costs from one place.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={buttonStyles("primary", "lg", "w-full sm:w-auto")}>
              Start Free
            </Link>
            <a
              href="mailto:sales@agentos.dev?subject=AgentOS%20demo"
              className={buttonStyles("secondary", "lg", "w-full sm:w-auto")}
            >
              Book Demo
            </a>
          </div>
        </section>

        <section
          aria-label="Features"
          className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-card border border-border bg-surface p-5">
              <Icon aria-hidden className="size-5 text-primary" />
              <h2 className="mt-4 text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-1.5 text-sm text-muted">{body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} AgentOS
      </footer>
    </div>
  );
}
