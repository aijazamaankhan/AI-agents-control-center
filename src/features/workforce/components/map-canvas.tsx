"use client";

import { AlertTriangle, Hand, LoaderCircle, Moon, Plus, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { DepartmentIcon } from "./department-icon";
import { formatCost, formatTokens } from "../format";
import { LAYOUT, type MapLayout } from "../layout";
import { countByStatus, type SimState } from "../simulation";
import type { AgentRuntime, WorkforceAgent, WorkforceDepartment } from "../types";
import { departmentAccent, PROVIDER_STYLE, STATUS_STYLE, tint } from "../visuals";

export type Selection = { type: "department" | "agent"; id: string } | null;

interface MapCanvasProps {
  departments: WorkforceDepartment[];
  layout: MapLayout;
  state: SimState;
  selection: Selection;
  onSelect: (s: Selection) => void;
  animate: boolean;
}

function agentLine(agent: WorkforceAgent, rt: AgentRuntime): string {
  if (rt.status === "WAITING") return "Needs approval";
  if (rt.status === "FAILED") return "Failed · will retry";
  if (rt.status === "IDLE") return "Idle";
  if (rt.stage === "tool" && rt.tool) return `Using ${rt.tool}`;
  if (rt.stage === "done") return "Wrapping up";
  return `Thinking · ${agent.model}`;
}

const STATUS_ICON = {
  WORKING: LoaderCircle,
  WAITING: Hand,
  IDLE: Moon,
  FAILED: AlertTriangle,
} as const;

export function MapCanvas({
  departments,
  layout,
  state,
  selection,
  onSelect,
  animate,
}: MapCanvasProps) {
  const totals = countByStatus(state);
  const selectedDept =
    selection?.type === "department"
      ? selection.id
      : selection?.type === "agent"
        ? departments.find((d) => d.agents.some((a) => a.id === selection.id))?.id
        : undefined;
  const { hub, cardTop, cardWidth, cardHeight, agentHeight } = LAYOUT;

  return (
    <div className="relative" style={{ width: layout.width, height: layout.height }}>
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0"
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
      >
        <defs>
          <filter id="packet-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {departments.map((dep, i) => {
          const lane = layout.lanes[i]!;
          const accent = departmentAccent(dep.name, i);
          const counts = countByStatus(
            state,
            dep.agents.map((a) => a.id),
          );
          const active = counts.WORKING > 0;
          const dim = selectedDept && selectedDept !== dep.id;
          return (
            <g key={dep.id} opacity={dim ? 0.25 : 1} style={{ transition: "opacity 300ms" }}>
              <path
                d={lane.hubPath}
                fill="none"
                stroke="var(--color-border-strong)"
                strokeWidth={1.5}
              />
              {active ? (
                <path
                  d={lane.hubPath}
                  fill="none"
                  stroke={accent}
                  strokeOpacity={0.75}
                  strokeWidth={1.5}
                  strokeDasharray="4 6"
                  className={animate ? "animate-flow-dash" : undefined}
                />
              ) : null}
              {animate && active
                ? Array.from({ length: Math.min(3, counts.WORKING) }, (_, k) => (
                    <circle key={k} r={3} fill={accent} filter="url(#packet-glow)">
                      <animateMotion
                        dur="2.6s"
                        repeatCount="indefinite"
                        begin={`${(k * 0.85 + i * 0.3).toFixed(2)}s`}
                        path={lane.hubPath}
                      />
                    </circle>
                  ))
                : null}
              {dep.agents.slice(0, lane.agents.length).map((agent, row) => {
                const rt = state.agents[agent.id];
                const d = lane.agentPaths[agent.id]!;
                const color = rt ? STATUS_STYLE[rt.status].color : "var(--color-muted)";
                const working = rt?.status === "WORKING";
                return (
                  <g key={agent.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke="var(--color-border-strong)"
                      strokeWidth={1.25}
                    />
                    {rt && rt.status !== "IDLE" ? (
                      <path
                        d={d}
                        fill="none"
                        stroke={color}
                        strokeOpacity={0.8}
                        strokeWidth={1.25}
                        strokeDasharray={working ? "3 5" : "2 4"}
                        className={animate && working ? "animate-flow-dash" : undefined}
                      />
                    ) : null}
                    {animate && working ? (
                      <circle r={2.5} fill={accent} filter="url(#packet-glow)">
                        <animateMotion
                          dur="1.8s"
                          repeatCount="indefinite"
                          begin={`${(row * 0.45).toFixed(2)}s`}
                          path={d}
                        />
                      </circle>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Hub */}
      <div
        className="absolute flex flex-col justify-between rounded-[20px] border p-4"
        style={{
          left: hub.x,
          top: hub.y,
          width: hub.width,
          height: hub.height,
          borderColor: tint("var(--color-primary)", 35),
          background: `radial-gradient(120% 90% at 0% 0%, ${tint("var(--color-primary)", 14)}, var(--color-surface) 60%)`,
          boxShadow: `0 0 48px -12px ${tint("var(--color-primary)", 55)}`,
        }}
      >
        <div className="flex items-center gap-3">
          <span className="relative flex size-9 items-center justify-center rounded-full bg-primary text-background">
            {animate ? (
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary" />
            ) : null}
            <Radio aria-hidden className="relative size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[0.14em] text-foreground">AGENTOS</p>
            <p className="text-[11px] text-muted">Control plane</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["Working", totals.WORKING, "var(--color-primary)"],
              ["Approval", totals.WAITING, "var(--color-warning)"],
              ["Failed", totals.FAILED, "var(--color-error)"],
            ] as const
          ).map(([label, value, color]) => (
            <div key={label} className="rounded-control bg-raised/80 py-1.5">
              <dd
                className="font-display text-2xl leading-none font-medium tabular-nums"
                style={{ color }}
              >
                {value}
              </dd>
              <dt className="mt-0.5 text-[10px] tracking-wide text-muted uppercase">{label}</dt>
            </div>
          ))}
        </dl>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted">Session</span>
          <span className="font-mono text-foreground tabular-nums">
            {formatTokens(state.totals.tokens)} tok · {formatCost(state.totals.cost)}
          </span>
        </div>
      </div>

      {/* Department lanes */}
      {departments.map((dep, i) => {
        const lane = layout.lanes[i]!;
        const accent = departmentAccent(dep.name, i);
        const counts = countByStatus(
          state,
          dep.agents.map((a) => a.id),
        );
        const isSelected = selection?.type === "department" && selection.id === dep.id;
        const dim = selectedDept && selectedDept !== dep.id;

        return (
          <div key={dep.id} className={cn("transition-opacity duration-300", dim && "opacity-35")}>
            <button
              type="button"
              onClick={() => onSelect(isSelected ? null : { type: "department", id: dep.id })}
              aria-pressed={isSelected}
              aria-label={`${dep.name}: ${counts.WORKING} of ${dep.agents.length} agents working`}
              className="absolute flex flex-col justify-between rounded-card border bg-surface p-3 text-left transition-[box-shadow,border-color] hover:bg-raised"
              style={{
                left: lane.x,
                top: cardTop,
                width: cardWidth,
                height: cardHeight,
                borderColor: isSelected ? accent : tint(accent, 30),
                boxShadow:
                  isSelected || counts.WORKING > 0 ? `0 0 32px -14px ${accent}` : undefined,
              }}
            >
              <span className="flex items-center gap-2.5">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-control"
                  style={{ background: tint(accent, 14), color: accent }}
                >
                  <DepartmentIcon name={dep.name} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {dep.name}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {dep.agents.length} agent{dep.agents.length === 1 ? "" : "s"}
                  </span>
                </span>
              </span>
              <span className="flex items-center justify-between text-[11px]">
                <span
                  className="flex items-center gap-1.5"
                  style={{ color: counts.WORKING ? accent : undefined }}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      counts.WORKING && animate && "animate-blink",
                    )}
                    style={{ background: counts.WORKING ? accent : "var(--color-muted)" }}
                  />
                  <span className={counts.WORKING ? undefined : "text-muted"}>
                    {counts.WORKING} working
                  </span>
                </span>
                {counts.WAITING ? (
                  <span className="text-warning">{counts.WAITING} approval</span>
                ) : null}
                {counts.FAILED ? <span className="text-error">{counts.FAILED} failed</span> : null}
              </span>
            </button>

            {lane.agents.map(({ agentId, x, y }) => {
              const agent = dep.agents.find((a) => a.id === agentId)!;
              const rt = state.agents[agentId]!;
              const status = STATUS_STYLE[rt.status];
              const StatusIcon = STATUS_ICON[rt.status];
              const provider = PROVIDER_STYLE[agent.provider] ?? PROVIDER_STYLE.Custom!;
              const isAgentSelected = selection?.type === "agent" && selection.id === agentId;
              return (
                <button
                  key={agentId}
                  type="button"
                  onClick={() => onSelect(isAgentSelected ? null : { type: "agent", id: agentId })}
                  aria-pressed={isAgentSelected}
                  aria-label={`${agent.name}, ${status.label}`}
                  className="absolute flex items-center gap-2.5 rounded-[12px] border bg-raised/90 px-2.5 text-left backdrop-blur-sm transition-colors hover:bg-elevated"
                  style={{
                    left: x,
                    top: y,
                    width: cardWidth - 26,
                    height: agentHeight,
                    borderColor: isAgentSelected
                      ? accent
                      : tint(status.color, rt.status === "IDLE" ? 12 : 30),
                  }}
                >
                  <span className="relative flex size-8 shrink-0 items-center justify-center">
                    {rt.status === "WORKING" && animate ? (
                      <span
                        className="absolute inset-0 animate-pulse-ring rounded-full"
                        style={{ background: tint(status.color, 45) }}
                      />
                    ) : null}
                    <span
                      className="relative flex size-8 items-center justify-center rounded-full border text-xs font-bold"
                      style={{
                        borderColor: tint(provider.color, 40),
                        color: provider.color,
                        background: "var(--color-surface)",
                      }}
                    >
                      {provider.label}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {agent.name}
                    </span>
                    <span
                      className="mt-0.5 flex items-center gap-1 text-[11px]"
                      style={{ color: status.color }}
                    >
                      <StatusIcon
                        aria-hidden
                        className={cn(
                          "size-3 shrink-0",
                          rt.status === "WORKING" && animate && "animate-spin",
                        )}
                      />
                      <span className="truncate">{agentLine(agent, rt)}</span>
                    </span>
                  </span>
                </button>
              );
            })}

            {lane.overflow > 0 && lane.overflowY !== null ? (
              <button
                type="button"
                onClick={() => onSelect({ type: "department", id: dep.id })}
                className="absolute flex items-center gap-2 rounded-[12px] border border-dashed border-border-strong px-3 text-xs text-muted hover:border-primary hover:text-foreground"
                style={{
                  left: lane.x + 26,
                  top: lane.overflowY,
                  width: cardWidth - 26,
                  height: 40,
                }}
              >
                <Plus aria-hidden className="size-3.5" />
                {lane.overflow} more agent{lane.overflow === 1 ? "" : "s"}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
