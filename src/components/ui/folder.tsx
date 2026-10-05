import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FolderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Panel title (on the folder's label tab, or as the card heading). */
  tab?: ReactNode;
  /** Heading level for the title; omit for a plain label (e.g. KPI names). */
  as?: "h2" | "h3";
  /**
   * "folder" = realistic file folder (used for the KPI row at the top of pages);
   * "card" = regular panel with a title (everything below).
   */
  variant?: "card" | "folder";
  /** CSS colour that tints the folder (or a card's border, e.g. danger zones). */
  accent?: string;
  /** Right-aligned controls on the top row. */
  actions?: ReactNode;
  /** Folder only: lift the paper and tip the front cover on hover. */
  interactive?: boolean;
  /** Classes for the content area (padding, overflow, …). */
  className?: string;
  /** Classes for the outer wrapper (grid placement, height). */
  wrapperClassName?: string;
}

/** Titled panel. As a "folder": tabbed back cover, a sheet of paper, and a front cover. */
export function Folder({
  tab,
  as: Heading,
  variant = "card",
  accent,
  actions,
  interactive = false,
  className,
  wrapperClassName,
  children,
  ...props
}: FolderProps) {
  const Title = Heading ?? "span";

  if (variant === "card") {
    return (
      <section
        className={cn(
          "flex flex-col rounded-[22px] border border-border bg-surface",
          wrapperClassName,
        )}
        style={
          accent ? { borderColor: `color-mix(in oklab, ${accent} 35%, transparent)` } : undefined
        }
      >
        {tab || actions ? (
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
            {tab ? (
              <Title className="text-sm font-semibold text-foreground">{tab}</Title>
            ) : (
              <span />
            )}
            {actions}
          </div>
        ) : null}
        <div className={cn("min-w-0 flex-1", className)} {...props}>
          {children}
        </div>
      </section>
    );
  }

  const style = accent ? ({ "--folder-accent": accent } as CSSProperties) : undefined;
  return (
    <div
      className={cn("folder", interactive && "folder-interactive", wrapperClassName)}
      style={style}
    >
      <div aria-hidden className="folder-back" />
      {tab ? (
        <div className="folder-tab">
          <span aria-hidden className="folder-tab-dot" />
          <Title className="truncate text-[length:inherit] font-semibold">{tab}</Title>
        </div>
      ) : null}
      <div aria-hidden className="folder-paper" />
      <div className={cn("folder-front", className)} {...props}>
        {actions ? <div className="flex justify-end gap-2 px-5 pt-4">{actions}</div> : null}
        {children}
      </div>
    </div>
  );
}
