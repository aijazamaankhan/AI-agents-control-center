"use client";

import { ChevronLeft, ChevronRight, FlaskConical, Pause, Play } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { computeLayout, LAYOUT } from "../layout";
import type { SimState } from "../simulation";
import type { WorkforceDepartment } from "../types";
import { STATUS_STYLE } from "../visuals";
import { ActivityFeed } from "./activity-feed";
import { DetailPanel } from "./detail-panel";
import { MapCanvas, type Selection } from "./map-canvas";
import { useLiveActivity, type LiveSeed } from "./use-live-activity";
import { usePrefersReducedMotion, useWorkforceSim } from "./use-workforce-sim";

interface WorkforceMapProps {
  departments: WorkforceDepartment[];
  /** Marks the data as sample/preview — required whenever data isn't the org's own. */
  sample?: boolean;
  variant?: "dashboard" | "landing";
  /** Real agent state (no simulation). Provide whenever departments are the org's own data. */
  live?: LiveSeed;
  className?: string;
}

export function WorkforceMap({
  departments,
  sample = false,
  live,
  variant = "dashboard",
  className,
}: WorkforceMapProps) {
  const layout = useMemo(() => computeLayout(departments), [departments]);
  const sim = useWorkforceSim(departments, { enabled: !live });
  const { running, setRunning } = sim;
  const liveFeed = useLiveActivity(live, Boolean(live));
  const state: SimState = live ? liveFeed.state : sim.state;
  const reducedMotion = usePrefersReducedMotion();
  const [selection, setSelection] = useState<Selection>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const animate = running && !reducedMotion;

  const scrollBy = (dir: 1 | -1) =>
    scroller.current?.scrollBy({
      left: dir * LAYOUT.laneWidth * 2,
      behavior: reducedMotion ? "auto" : "smooth",
    });

  const select = (s: Selection) => {
    setSelection(s);
    const depId =
      s?.type === "department"
        ? s.id
        : s
          ? departments.find((d) => d.agents.some((a) => a.id === s.id))?.id
          : undefined;
    const lane = layout.lanes.find((l) => l.departmentId === depId);
    const el = scroller.current;
    if (
      lane &&
      el &&
      (lane.x < el.scrollLeft || lane.x + LAYOUT.cardWidth > el.scrollLeft + el.clientWidth)
    ) {
      el.scrollTo({ left: Math.max(0, lane.x - 40), behavior: reducedMotion ? "auto" : "smooth" });
    }
  };

  return (
    <section
      aria-label="Workforce map"
      className={cn("rounded-[22px] border border-border bg-surface", className)}
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Workforce map</h2>
            {live ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                title={liveFeed.connected ? "Receiving live events" : "Connecting to live events…"}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    liveFeed.connected ? "animate-blink bg-primary" : "bg-muted",
                  )}
                />
                {liveFeed.connected ? "Live" : "Connecting…"}
              </span>
            ) : null}
            {sample ? (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning"
                title="Sample agents and simulated activity. Connect your agents to see your own workforce."
              >
                <FlaskConical aria-hidden className="size-3" /> Sample workforce · simulated
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {departments.length} departments ·{" "}
            {departments.reduce((s, d) => s + d.agents.length, 0)} agents
            {variant === "dashboard" ? " · click a department or agent for details" : ""}
          </p>
        </div>
        <ul
          className="hidden items-center gap-3 text-[11px] text-muted md:flex"
          aria-label="Legend"
        >
          {Object.values(STATUS_STYLE).map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1">
          <IconButton label="Scroll departments left" onClick={() => scrollBy(-1)}>
            <ChevronLeft aria-hidden className="size-4" />
          </IconButton>
          <IconButton label="Scroll departments right" onClick={() => scrollBy(1)}>
            <ChevronRight aria-hidden className="size-4" />
          </IconButton>
          <IconButton
            label={running ? "Pause live activity" : "Resume live activity"}
            onClick={() => setRunning(!running)}
          >
            {running ? (
              <Pause aria-hidden className="size-4" />
            ) : (
              <Play aria-hidden className="size-4" />
            )}
          </IconButton>
        </div>
      </header>

      <div
        className={cn(
          "grid",
          variant === "dashboard"
            ? "xl:grid-cols-[minmax(0,1fr)_320px]"
            : "lg:grid-cols-[minmax(0,1fr)_300px]",
        )}
      >
        <div
          ref={scroller}
          tabIndex={0}
          aria-label="Workforce map canvas (scroll horizontally for more departments)"
          className="scroller-x bg-dots relative min-w-0 rounded-bl-[22px] focus-visible:outline-offset-[-2px]"
        >
          <MapCanvas
            departments={departments}
            layout={layout}
            state={state}
            selection={selection}
            onSelect={select}
            animate={animate}
          />
        </div>
        <aside
          style={{ "--map-h": `${layout.height}px` } as React.CSSProperties}
          className={cn(
            "flex min-h-0 flex-col border-t border-border p-4",
            variant === "dashboard"
              ? "xl:h-[var(--map-h)] xl:overflow-y-auto xl:border-t-0 xl:border-l"
              : "lg:h-[var(--map-h)] lg:overflow-y-auto lg:border-t-0 lg:border-l",
          )}
        >
          {variant === "dashboard" ? (
            <>
              <DetailPanel
                departments={departments}
                state={state}
                selection={selection}
                onSelect={select}
              />
              <h3 className="mt-6 mb-2 text-sm font-semibold text-foreground">Live activity</h3>
            </>
          ) : (
            <h3 className="mb-2 text-sm font-semibold text-foreground">Live activity</h3>
          )}
          <div
            className={cn(
              "pr-1",
              variant === "dashboard"
                ? "max-h-[420px] overflow-y-auto xl:max-h-none xl:overflow-visible"
                : "max-h-[420px] overflow-y-auto lg:max-h-none lg:overflow-visible",
            )}
          >
            <ActivityFeed
              events={state.events}
              departments={departments}
              limit={variant === "dashboard" ? 12 : 6}
              emptyText={
                live ? "Agent activity will appear here when your agents start working." : undefined
              }
            />
          </div>
        </aside>
      </div>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-control border border-border bg-raised text-muted hover:border-primary/50 hover:text-foreground"
    >
      {children}
    </button>
  );
}
