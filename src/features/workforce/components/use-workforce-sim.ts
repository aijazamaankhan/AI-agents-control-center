"use client";

import { useEffect, useRef, useState } from "react";
import { useMotion } from "@/components/motion-toggle";
import { createRng, initialSimState, stepSim, type Rng, type SimState } from "../simulation";
import type { WorkforceDepartment } from "../types";

/** True when animations should stop (OS setting or Settings → Appearance → Motion). */
export function usePrefersReducedMotion(): boolean {
  return useMotion() !== "animate";
}

/** Drives the preview simulation. Pausing stops both state changes and motion (WCAG 2.2.2). */
export function useWorkforceSim(
  departments: WorkforceDepartment[],
  {
    enabled = true,
    intervalMs = 1400,
    seed = 7,
  }: { enabled?: boolean; intervalMs?: number; seed?: number } = {},
) {
  const [state, setState] = useState<SimState>(() => initialSimState(departments));
  const [running, setRunning] = useState(true);
  const rngRef = useRef<Rng | null>(null);

  useEffect(() => {
    if (!running || !enabled) return;
    rngRef.current ??= createRng(seed);
    const rng = rngRef.current;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setState((s) => stepSim(s, departments, rng, Date.now()));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [running, enabled, departments, intervalMs, seed]);

  return { state, running, setRunning };
}
