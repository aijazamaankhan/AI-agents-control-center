import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  caption?: string;
  /** CSS colour (token var) for the icon chip and underline. */
  accent?: string;
  className?: string;
}

/** "Folder-tab" widget: a notched tab joined to the card body, big condensed numerals. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  caption,
  accent = "var(--color-primary)",
  className,
}: KpiCardProps) {
  return (
    <div className={cn("relative pt-3", className)}>
      <span aria-hidden className="absolute top-0 left-0 h-6 w-[58%] rounded-t-[14px] bg-surface" />
      <span
        aria-hidden
        className="absolute top-3 left-[58%] size-3 bg-surface [mask:radial-gradient(circle_at_100%_0,transparent_11.5px,#000_12px)]"
      />
      <div className="relative rounded-[18px] rounded-tl-none bg-surface px-4 pt-2 pb-4 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]">
        <div className="flex items-center justify-between">
          <p className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">
            {label}
          </p>
          <span
            className="flex size-7 items-center justify-center rounded-full"
            style={{ background: `color-mix(in oklab, ${accent} 14%, transparent)`, color: accent }}
          >
            <Icon aria-hidden className="size-3.5" />
          </span>
        </div>
        <p className="mt-2 font-display text-[44px] leading-none font-medium tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        <span
          aria-hidden
          className="mt-3 block h-0.5 w-8 rounded-full"
          style={{ background: accent }}
        />
        {caption ? <p className="mt-2 truncate text-[11px] text-muted">{caption}</p> : null}
      </div>
    </div>
  );
}
