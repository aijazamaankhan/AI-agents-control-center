import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FolderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Text on the folder's label tab (the panel title). */
  tab?: ReactNode;
  /** Heading level for the tab text; omit for a plain label (e.g. KPI names). */
  as?: "h2" | "h3";
  /** CSS colour that tints the back cover, tab dot and front edge. */
  accent?: string;
  /** Right-aligned controls on the front cover's top row. */
  actions?: ReactNode;
  /** Lift the paper and tip the front cover on hover (small widgets). */
  interactive?: boolean;
  /** Classes for the front cover (padding, overflow, …). */
  className?: string;
  /** Classes for the outer wrapper (grid placement, height). */
  wrapperClassName?: string;
}

/** Realistic file-folder panel: tabbed back cover, a sheet of paper, and a front cover. */
export function Folder({
  tab,
  as: Heading,
  accent,
  actions,
  interactive = false,
  className,
  wrapperClassName,
  children,
  ...props
}: FolderProps) {
  const style = accent ? ({ "--folder-accent": accent } as CSSProperties) : undefined;
  const TabText = Heading ?? "span";
  return (
    <div
      className={cn("folder", interactive && "folder-interactive", wrapperClassName)}
      style={style}
    >
      <div aria-hidden className="folder-back" />
      {tab ? (
        <div className="folder-tab">
          <span aria-hidden className="folder-tab-dot" />
          <TabText className="truncate text-[length:inherit] font-semibold">{tab}</TabText>
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
