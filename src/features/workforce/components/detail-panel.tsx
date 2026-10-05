"use client";

import { ArrowLeft, Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCost, formatTokens } from "../format";
import { countByStatus, type SimState } from "../simulation";
import type { TraceStage, WorkforceDepartment } from "../types";
import { departmentAccent, PROVIDER_STYLE, STATUS_STYLE, tint } from "../visuals";
import { DepartmentIcon } from "./department-icon";
import type { Selection } from "./map-canvas";

interface DetailPanelProps {
  departments: WorkforceDepartment[];
  state: SimState;
  selection: Selection;
  onSelect: (s: Selection) => void;
}

const TRACE: { stage: TraceStage; label: string }[] = [
  { stage: "start", label: "Task started" },
  { stage: "llm", label: "LLM call" },
  { stage: "tool", label: "Tool call" },
  { stage: "review", label: "Human approval" },
  { stage: "done", label: "Completed" },
];

function Overview({ departments, state, onSelect }: Omit<DetailPanelProps, "selection">) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">Departments</h3>
      <p className="mt-0.5 text-xs text-muted">
        Select a department or agent on the map for details.
      </p>
      <ul className="mt-3 space-y-1.5">
        {departments.map((dep, i) => {
          const accent = departmentAccent(dep.name, i);
          const c = countByStatus(
            state,
            dep.agents.map((a) => a.id),
          );
          const pct = dep.agents.length ? (c.WORKING / dep.agents.length) * 100 : 0;
          return (
            <li key={dep.id}>
              <button
                type="button"
                onClick={() => onSelect({ type: "department", id: dep.id })}
                className="group flex w-full items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-raised"
              >
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-control"
                  style={{ background: tint(accent, 14), color: accent }}
                >
                  <DepartmentIcon name={dep.name} className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium text-foreground">{dep.name}</span>
                    <span className="text-muted tabular-nums">
                      {c.WORKING}/{dep.agents.length}
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-raised">
                    <span
                      className="block h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%`, background: accent }}
                    />
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-4 text-muted group-hover:text-foreground"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DetailPanel({ departments, state, selection, onSelect }: DetailPanelProps) {
  if (!selection) return <Overview departments={departments} state={state} onSelect={onSelect} />;

  if (selection.type === "department") {
    const i = departments.findIndex((d) => d.id === selection.id);
    const dep = departments[i];
    if (!dep) return null;
    const accent = departmentAccent(dep.name, i);
    const c = countByStatus(
      state,
      dep.agents.map((a) => a.id),
    );
    const tokens = dep.agents.reduce((s, a) => s + (state.agents[a.id]?.tokens ?? 0), 0);
    const cost = dep.agents.reduce((s, a) => s + (state.agents[a.id]?.cost ?? 0), 0);

    return (
      <div>
        <PanelHeader onBack={() => onSelect(null)} />
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-card"
            style={{ background: tint(accent, 14), color: accent }}
          >
            <DepartmentIcon name={dep.name} className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">{dep.name}</h3>
            <p className="text-xs text-muted">{dep.agents.length} agents</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-4 gap-2">
          <Stat label="Working" value={c.WORKING} color="var(--color-primary)" />
          <Stat label="Approval" value={c.WAITING} color="var(--color-warning)" />
          <Stat label="Idle" value={c.IDLE} color="var(--color-muted)" />
          <Stat label="Failed" value={c.FAILED} color="var(--color-error)" />
        </dl>
        <p className="mt-3 font-mono text-[11px] text-muted tabular-nums">
          Session: {formatTokens(tokens)} tokens · {formatCost(cost)}
        </p>
        <ul className="mt-4 space-y-1">
          {dep.agents.map((a) => {
            const rt = state.agents[a.id]!;
            const s = STATUS_STYLE[rt.status];
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => onSelect({ type: "agent", id: a.id })}
                  className="flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left hover:bg-raised"
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {a.name}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {rt.task ?? "No active task"}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px]" style={{ color: s.color }}>
                    {s.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const depIndex = departments.findIndex((d) => d.agents.some((a) => a.id === selection.id));
  const dep = departments[depIndex];
  const agent = dep?.agents.find((a) => a.id === selection.id);
  const rt = agent ? state.agents[agent.id] : undefined;
  if (!dep || !agent || !rt) return null;
  const accent = departmentAccent(dep.name, depIndex);
  const status = STATUS_STYLE[rt.status];
  const provider = PROVIDER_STYLE[agent.provider] ?? PROVIDER_STYLE.Custom!;
  const steps = TRACE.filter((t) => t.stage !== "review" || agent.approvalAction);
  const currentIdx =
    rt.stage === "failed" ? steps.length - 1 : steps.findIndex((t) => t.stage === rt.stage);
  const recent = state.events.filter((e) => e.agentId === agent.id).slice(0, 4);

  return (
    <div>
      <PanelHeader
        onBack={() => onSelect({ type: "department", id: dep.id })}
        backLabel={dep.name}
      />
      <div className="flex items-center gap-3">
        <span
          className="flex size-10 items-center justify-center rounded-full border text-sm font-bold"
          style={{ borderColor: tint(provider.color, 40), color: provider.color }}
        >
          {provider.label}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">{agent.name}</h3>
          <p className="text-xs text-muted">
            <span style={{ color: accent }}>{dep.name}</span> · {agent.provider} · {agent.model}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs">
        <span className="font-medium" style={{ color: status.color }}>
          {status.label}
        </span>
        <span className="text-muted"> · {rt.task ?? "No active task"}</span>
      </p>

      <h4 className="mt-4 text-[11px] font-semibold tracking-wide text-muted uppercase">
        Execution trace
      </h4>
      <ol className="mt-2 space-y-0">
        {steps.map((step, i) => {
          const done = rt.stage !== null && i < currentIdx;
          const current = rt.stage !== null && i === currentIdx;
          const failed = current && rt.stage === "failed";
          const color = failed
            ? "var(--color-error)"
            : current
              ? status.color
              : done
                ? "var(--color-primary)"
                : "var(--color-border-strong)";
          return (
            <li key={step.stage} className="relative flex items-center gap-3 py-1.5">
              {i < steps.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute top-6 left-[9px] h-[calc(100%-12px)] w-px"
                  style={{ background: done ? "var(--color-primary)" : "var(--color-border)" }}
                />
              ) : null}
              <span
                className={cn(
                  "relative flex size-[19px] items-center justify-center rounded-full border-2",
                  current && !failed && "animate-blink",
                )}
                style={{ borderColor: color, background: done ? color : "transparent" }}
              >
                {done ? (
                  <Check aria-hidden className="size-3 text-background" strokeWidth={3} />
                ) : null}
                {failed ? <X aria-hidden className="size-3 text-error" strokeWidth={3} /> : null}
              </span>
              <span
                className={cn(
                  "text-xs",
                  current ? "font-medium text-foreground" : done ? "text-foreground" : "text-muted",
                )}
              >
                {failed ? "Failed" : step.label}
                {current && step.stage === "tool" && rt.tool ? (
                  <span className="text-muted"> · {rt.tool}</span>
                ) : null}
                {current && step.stage === "review" ? (
                  <span className="text-warning"> · {agent.approvalAction}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Tokens" value={formatTokens(rt.tokens)} color="var(--color-cyan)" />
        <Stat label="Cost" value={formatCost(rt.cost)} color="var(--color-lime)" />
        <Stat label="Done" value={rt.completed} color="var(--color-primary)" />
      </dl>

      <h4 className="mt-4 text-[11px] font-semibold tracking-wide text-muted uppercase">Tools</h4>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {agent.tools.map((t) => (
          <span
            key={t}
            className="rounded-full border border-border bg-raised px-2 py-0.5 font-mono text-[11px] text-muted"
          >
            {t}
          </span>
        ))}
      </div>

      {recent.length ? (
        <>
          <h4 className="mt-4 text-[11px] font-semibold tracking-wide text-muted uppercase">
            Recent events
          </h4>
          <ul className="mt-2 space-y-1">
            {recent.map((e) => (
              <li key={e.id} className="truncate text-[11px] text-muted">
                {e.text}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function PanelHeader({
  onBack,
  backLabel = "All departments",
}: {
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
    >
      <ArrowLeft aria-hidden className="size-3.5" /> {backLabel}
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-control border border-border bg-raised/60 px-2 py-1.5 text-center">
      <dd className="font-display text-xl leading-none font-medium tabular-nums" style={{ color }}>
        {value}
      </dd>
      <dt className="mt-1 text-[10px] tracking-wide text-muted uppercase">{label}</dt>
    </div>
  );
}
