"use client";

import { Check, X } from "lucide-react";
import { useActionState } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/validation/action-state";
import { decideApprovalAction } from "../actions";

/** Approve / reject with an optional note (shown to the team and returned to the agent). */
export function DecideForm({ id, action }: { id: string; action: string }) {
  const [state, formAction, pending] = useActionState(decideApprovalAction, initialActionState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`note-${id}`}>
        Note for “{action}” (optional)
      </label>
      <Input
        id={`note-${id}`}
        name="note"
        maxLength={500}
        placeholder="Note (optional) — e.g. “Only to existing customers”"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="APPROVED" size="sm" disabled={pending}>
          <Check aria-hidden className="size-4" /> Approve
        </Button>
        <Button
          type="submit"
          name="decision"
          value="REJECTED"
          variant="secondary"
          size="sm"
          disabled={pending}
        >
          <X aria-hidden className="size-4" /> Reject
        </Button>
      </div>
      <FormMessage ok={state.ok} message={state.message} />
    </form>
  );
}
