"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createRng, initialSimState, stepSim, type Rng, type SimState } from "../simulation";
import type { WorkforceDepartment } from "../types";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCED_MOTION);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** Drives the preview simulation. Pausing stops both state changes and motion (WCAG 2.2.2). */
export function useWorkforceSim(departments: WorkforceDepartment[], intervalMs = 1400, seed = 7) {
  const [state, setState] = useState<SimState>(() => initialSimState(departments));
  const [running, setRunning] = useState(true);
  const rngRef = useRef<Rng | null>(null);

  useEffect(() => {
    if (!running) return;
    rngRef.current ??= createRng(seed);
    const rng = rngRef.current;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setState((s) => stepSim(s, departments, rng, Date.now()));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [running, departments, intervalMs, seed]);

  return { state, running, setRunning };
}
