import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  caption?: string;
}

export function KpiCard({ label, value, icon: Icon, caption }: KpiCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
        <Icon aria-hidden className="size-4 text-muted" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-foreground tabular-nums">{value}</p>
      {caption ? <p className="mt-1 text-xs text-muted">{caption}</p> : null}
    </Card>
  );
}
