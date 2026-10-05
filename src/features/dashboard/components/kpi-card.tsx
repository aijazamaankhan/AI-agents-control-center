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
      variant="folder"
      interactive
      wrapperClassName={className}
      className="flex min-h-[156px] flex-col px-4 pt-5 pb-5"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-[48px] leading-none font-medium tracking-tight text-foreground tabular-nums">
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
        className="mt-auto block h-0.5 w-8 rounded-full"
        style={{ background: accent }}
      />
      {caption ? <p className="mt-2.5 truncate text-xs text-muted">{caption}</p> : null}
    </Folder>
  );
}
