import {
  CircleCheck,
  CircleDashed,
  CircleOff,
  CirclePause,
  CircleX,
  Clock,
  LoaderCircle,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentStatus =
  "ONLINE" | "WORKING" | "IDLE" | "WAITING" | "FAILED" | "OFFLINE" | "DISCONNECTED";

const STATUS: Record<AgentStatus, { label: string; icon: LucideIcon; className: string }> = {
  ONLINE: { label: "Online", icon: CircleCheck, className: "text-success" },
  WORKING: { label: "Working", icon: LoaderCircle, className: "text-primary" },
  IDLE: { label: "Idle", icon: CirclePause, className: "text-muted" },
  WAITING: { label: "Waiting", icon: Clock, className: "text-warning" },
  FAILED: { label: "Failed", icon: CircleX, className: "text-error" },
  OFFLINE: { label: "Offline", icon: CircleOff, className: "text-muted" },
  DISCONNECTED: { label: "Disconnected", icon: Unplug, className: "text-error" },
};

/** Status is always icon + text + color — never color alone. */
export function StatusIndicator({
  status,
  className,
}: {
  status: AgentStatus;
  className?: string;
}) {
  const def = STATUS[status] ?? { label: status, icon: CircleDashed, className: "text-muted" };
  const Icon = def.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        def.className,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {def.label}
    </span>
  );
}
