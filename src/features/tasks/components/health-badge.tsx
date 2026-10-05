import { CircleAlert, CircleCheck, CircleDashed, CircleX, type LucideIcon } from "lucide-react";
import type { Health } from "../health";

const STYLE: Record<Health, { label: string; icon: LucideIcon; color: string }> = {
  HEALTHY: { label: "Healthy", icon: CircleCheck, color: "var(--color-primary)" },
  WARNING: { label: "Warning", icon: CircleAlert, color: "var(--color-warning)" },
  CRITICAL: { label: "Critical", icon: CircleX, color: "var(--color-error)" },
  UNKNOWN: { label: "No data", icon: CircleDashed, color: "var(--color-muted)" },
};

/** Health with icon + label (never colour alone); reasons in the native tooltip. */
export function HealthBadge({ health, reasons = [] }: { health: Health; reasons?: string[] }) {
  const s = STYLE[health];
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color: s.color }}
      title={reasons.length ? reasons.join(" · ") : s.label}
    >
      <Icon aria-hidden className="size-3.5" />
      {s.label}
    </span>
  );
}
