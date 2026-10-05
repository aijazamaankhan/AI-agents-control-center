"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export type ThemePreference = "dark" | "light" | "system";
export const THEME_STORAGE_KEY = "agentos-theme";

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const listeners = new Set<() => void>();

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* storage unavailable: still apply for this page */
  }
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  listeners.forEach((l) => l());
}

function usePreference(): ThemePreference {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => e.key === THEME_STORAGE_KEY && cb();
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => "dark",
  );
}

/** Segmented light / dark / system switch. */
export function ThemeToggle({
  className,
  showLabels = false,
}: {
  className?: string;
  showLabels?: boolean;
}) {
  const pref = usePreference();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("inline-flex rounded-control border border-border bg-raised p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          onClick={() => applyTheme(value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-[7px] px-2 text-xs transition-colors",
            pref === value
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground",
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {showLabels ? label : null}
        </button>
      ))}
    </div>
  );
}
