"use client";

import { Pause, Play, Sparkles, type LucideIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Motion preference, stored per device like the theme. "system" follows the OS
 * (prefers-reduced-motion); "full" always animates; "reduced" never does. Applied as
 * <html data-motion> before first paint (see app/layout.tsx) so CSS and JS agree.
 */
export type MotionPreference = "system" | "full" | "reduced";
export const MOTION_STORAGE_KEY = "agentos-motion";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

const OPTIONS: { value: MotionPreference; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Sparkles },
  { value: "full", label: "Always animate", icon: Play },
  { value: "reduced", label: "Reduce", icon: Pause },
];

const listeners = new Set<() => void>();

function readPreference(): MotionPreference {
  try {
    const v = localStorage.getItem(MOTION_STORAGE_KEY);
    return v === "full" || v === "reduced" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyMotion(pref: MotionPreference) {
  try {
    localStorage.setItem(MOTION_STORAGE_KEY, pref);
  } catch {
    /* storage unavailable: still apply for this page */
  }
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-motion");
  else root.setAttribute("data-motion", pref);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  const onStorage = (e: StorageEvent) => e.key === MOTION_STORAGE_KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
    window.removeEventListener("storage", onStorage);
  };
}

export type MotionState = "animate" | "reduced-by-system" | "reduced-by-user";

function readState(): MotionState {
  const pref = readPreference();
  if (pref === "full") return "animate";
  if (pref === "reduced") return "reduced-by-user";
  return window.matchMedia(REDUCED_QUERY).matches ? "reduced-by-system" : "animate";
}

/** Whether to animate, and why not (so the UI can explain a paused map). */
export function useMotion(): MotionState {
  return useSyncExternalStore(subscribe, readState, () => "animate");
}

function usePreference(): MotionPreference {
  return useSyncExternalStore(subscribe, readPreference, () => "system");
}

/** Segmented System / Always animate / Reduce switch (Settings → Appearance). */
export function MotionToggle({ className }: { className?: string }) {
  const pref = usePreference();
  return (
    <div
      role="radiogroup"
      aria-label="Motion"
      className={cn("inline-flex rounded-control border border-border bg-raised p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          onClick={() => applyMotion(value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 text-xs transition-colors",
            pref === value
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
