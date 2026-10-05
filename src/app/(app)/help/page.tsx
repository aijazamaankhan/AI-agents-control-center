import {
  Activity,
  Bot,
  Building2,
  CircleDollarSign,
  Map,
  Monitor,
  Pause,
  Rocket,
  Settings,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { STATUS_STYLE } from "@/features/workforce/visuals";

export const metadata: Metadata = { title: "Help & guide" };

interface Section {
  id: string;
  icon: LucideIcon;
  title: string;
  status?: "available" | "soon";
  body: ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    icon: Rocket,
    title: "Getting started",
    status: "available",
    body: (
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>Create your account, then your company (name, industry, size, country, timezone).</li>
        <li>Create departments — the teams your agents belong to (Sales, Support, Finance…).</li>
        <li>Connect your first agent and send events with the AgentOS SDK or Event API.</li>
        <li>Watch the dashboard: live activity, tokens, cost and anything that needs approval.</li>
      </ol>
    ),
  },
  {
    id: "workforce-map",
    icon: Map,
    title: "Reading the workforce map",
    status: "available",
    body: (
      <div className="space-y-3">
        <p>
          The map shows the <strong className="text-foreground">AgentOS hub</strong> on the left and
          one <strong className="text-foreground">lane per department</strong>. Lanes extend to the
          right — scroll sideways (trackpad, shift + wheel, or the ‹ › buttons) when your company
          has many departments. Each lane shows up to four agents; use “+ N more” to see the rest in
          the side panel.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {Object.values(STATUS_STYLE).map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              <span className="text-foreground">{s.label}</span>
            </li>
          ))}
        </ul>
        <p>
          Glowing dots travelling along the lines are events (model calls, tool calls, results)
          flowing from agents to their department and into the control plane. Click a department for
          its agents and totals; click an agent for its live execution trace, tools and recent
          events.
        </p>
        <p className="flex items-center gap-2">
          <Pause aria-hidden className="size-4 text-primary" /> Use the pause button to stop motion.
          Animations are also reduced automatically when your system’s “reduce motion” setting is
          on.
        </p>
        <p className="rounded-control border border-warning/30 bg-warning/10 px-3 py-2 text-warning">
          Until you connect agents, the map shows a clearly-labelled sample workforce with simulated
          activity. Your KPI cards always show your real numbers.
        </p>
      </div>
    ),
  },
  {
    id: "departments",
    icon: Building2,
    title: "Departments",
    status: "available",
    body: (
      <p>
        Departments group agents by the team that owns them. Owners and admins can create, rename
        and delete departments from the Departments page; every change is recorded in the audit log.
        A department that still has agents cannot be deleted.
      </p>
    ),
  },
  {
    id: "agents",
    icon: Bot,
    title: "Agents & tasks",
    status: "available",
    body: (
      <p>
        Connect agents via SDK, REST API, webhook or MCP. Every agent gets a permanent ID (
        <code>agt_…</code>) and reports tasks, LLM calls and tool calls. Each task has an expandable
        execution trace with tokens, cost and latency per step.
      </p>
    ),
  },
  {
    id: "costs",
    icon: CircleDollarSign,
    title: "Tokens & costs",
    status: "available",
    body: (
      <p>
        Every model call your agents report is priced from a versioned price list (USD per 1M input,
        output and cached tokens), so historical costs stay auditable when prices change. Calls for
        a model without a price show as <em>unpriced</em> ($0) until Velorex adds one. Open{" "}
        <strong>Costs &amp; Usage</strong> for daily spend by department, agent and model. Budgets
        with alerts arrive in Phase 9.
      </p>
    ),
  },
  {
    id: "approvals",
    icon: ShieldCheck,
    title: "Approvals",
    status: "available",
    body: (
      <p>
        When an agent asks before a risky action (sending external email, refunds, payments,
        publishing), its permission rule decides: <strong>Allowed</strong> and{" "}
        <strong>Denied</strong> are answered instantly; <strong>Requires approval</strong> waits in{" "}
        <strong>Approvals</strong> for an owner, admin or manager. The agent and its task pause
        until you approve or reject (with an optional note the agent receives). Every decision is
        audited and shown in the task trace.
      </p>
    ),
  },
  {
    id: "desktop",
    icon: Monitor,
    title: "Desktop app",
    status: "available",
    body: (
      <p>
        Run AgentOS as a desktop app on Windows, macOS or Linux, with a tray icon, desktop
        notifications for new approvals and failed tasks, and a quick approval pop-up. From the
        project folder run <code className="font-mono text-xs">npm run desktop</code> (or{" "}
        <code className="font-mono text-xs">npm run desktop:build</code> for an installer), then
        connect it to this server&apos;s address.
      </p>
    ),
  },
  {
    id: "activity",
    icon: Activity,
    title: "Live activity",
    status: "available",
    body: (
      <p>
        The activity feed lists the newest agent events first, with tokens and cost for model calls.
      </p>
    ),
  },
  {
    id: "settings",
    icon: Settings,
    title: "Settings & roles",
    status: "available",
    body: (
      <p>
        Owners and admins can edit the organization profile. Roles:{" "}
        <strong className="text-foreground">Owner</strong> (everything incl. billing and budgets),{" "}
        <strong className="text-foreground">Admin</strong> (agents, departments, users,
        integrations), <strong className="text-foreground">Manager</strong> (assigned departments,
        approvals, analytics), <strong className="text-foreground">Member</strong> and{" "}
        <strong className="text-foreground">Viewer</strong> (read-only).
      </p>
    ),
  },
  {
    id: "developers",
    icon: Terminal,
    title: "For developers",
    status: "available",
    body: (
      <ul className="space-y-1.5">
        <li>
          <code>npm run dev</code> — start everything (built-in database included) ·{" "}
          <code>npm run demo:agent -- --key aos_live_…</code> — a simulated agent that reports live
          events
        </li>
        <li>
          <code>npm run lint</code> · <code>npm run typecheck</code> · <code>npm run test</code> ·{" "}
          <code>npm run build</code> — the quality gate
        </li>
        <li>
          <code>GET /api/health</code> — liveness and database check
        </li>
        <li>
          Full guide incl. Windows setup: <code>docs/USER_GUIDE.md</code> in the repository.
        </li>
      </ul>
    ),
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Help & guide</h1>
      <p className="mt-1 text-sm text-muted">How to use AgentOS and its tools.</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Help sections" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:pb-0">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-control px-3 py-1.5 text-sm whitespace-nowrap text-muted hover:bg-raised hover:text-foreground"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-4">
          {SECTIONS.map(({ id, icon: Icon, title, status, body }) => (
            <section
              key={id}
              id={id}
              aria-labelledby={`${id}-title`}
              className="scroll-mt-24 rounded-[20px] border border-border bg-surface p-5 sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <Icon aria-hidden className="size-4" />
                </span>
                <h2 id={`${id}-title`} className="text-base font-semibold text-foreground">
                  {title}
                </h2>
                {status === "soon" ? (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted uppercase">
                    Coming soon
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-sm leading-relaxed text-muted [&_code]:rounded [&_code]:bg-raised [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_code]:text-foreground">
                {body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
