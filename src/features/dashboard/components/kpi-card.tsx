import type { LucideIcon } from "lucide-react";
import { Folder } from "@/components/ui/folder";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  caption?: string;
  /** CSS colour (token var) for the folder tint, icon chip and underline. */
  accent?: string;
  className?: string;
}

/** KPI as a small file folder: the metric name on the tab, big condensed numerals on the front. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  caption,
  accent = "var(--color-primary)",
  className,
}: KpiCardProps) {
  return (
    <Folder
      tab={label}
      accent={accent}
      interactive
      wrapperClassName={className}
      className="px-4 pt-3 pb-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-[44px] leading-none font-medium tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full"
          style={{ background: `color-mix(in oklab, ${accent} 16%, transparent)`, color: accent }}
        >
          <Icon aria-hidden className="size-3.5" />
        </span>
      </div>
      <span
        aria-hidden
        className="mt-3 block h-0.5 w-8 rounded-full"
        style={{ background: accent }}
      />
      {caption ? <p className="mt-2 truncate text-[11px] text-muted">{caption}</p> : null}
    </Folder>
  );
}
