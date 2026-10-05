import { CircleCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormMessage({ ok, message }: { ok: boolean; message?: string }) {
  if (!message) return null;
  const Icon = ok ? CircleCheck : TriangleAlert;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-control border px-3 py-2 text-sm",
        ok
          ? "border-success/30 bg-success/10 text-success"
          : "border-error/30 bg-error/10 text-error",
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
