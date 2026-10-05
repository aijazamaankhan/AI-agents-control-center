"use client";

import { useActionState, useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { CopyButton } from "@/features/agents/components/api-key-reveal";
import { cn } from "@/lib/utils";
import { initialActionState } from "@/lib/validation/action-state";
import { adminAction } from "../actions";

interface Props {
  op: string;
  id: string;
  label: string;
  /** When set, a second click is required (inline confirmation). */
  confirm?: string;
  variant?: ButtonVariant;
  className?: string;
}

export function AdminActionButton({
  op,
  id,
  label,
  confirm,
  variant = "secondary",
  className,
}: Props) {
  const [state, action, pending] = useActionState(adminAction, initialActionState);
  const [confirming, setConfirming] = useState(false);
  const temp = state.data?.temporaryPassword;

  return (
    <div className={cn("space-y-2", className)}>
      {confirm && confirming ? (
        <form
          action={action}
          className="flex flex-wrap items-center gap-2"
          onSubmit={() => setConfirming(false)}
        >
          <input type="hidden" name="op" value={op} />
          <input type="hidden" name="id" value={id} />
          <span className="text-xs text-foreground">{confirm}</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            type="submit"
            variant={variant === "danger" ? "danger" : "primary"}
            disabled={pending}
          >
            {pending ? "Working…" : "Confirm"}
          </Button>
        </form>
      ) : confirm ? (
        <Button
          size="sm"
          variant={variant === "danger" ? "secondary" : variant}
          className={variant === "danger" ? "text-error" : undefined}
          onClick={() => setConfirming(true)}
        >
          {label}
        </Button>
      ) : (
        <form action={action}>
          <input type="hidden" name="op" value={op} />
          <input type="hidden" name="id" value={id} />
          <Button size="sm" type="submit" variant={variant} disabled={pending}>
            {pending ? "Working…" : label}
          </Button>
        </form>
      )}
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={cn("text-xs", state.ok ? "text-primary" : "text-error")}
        >
          {state.message}
        </p>
      ) : null}
      {temp ? (
        <div className="flex items-center gap-2 rounded-control border border-warning/30 bg-warning/10 p-2">
          <code data-testid="temporary-password" className="font-mono text-xs text-foreground">
            {temp}
          </code>
          <CopyButton value={temp} />
        </div>
      ) : null}
    </div>
  );
}
