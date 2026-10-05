"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/validation/action-state";
import { deleteDepartmentAction } from "../actions";

/** Two-step delete: the first click asks for confirmation inline (no modal needed). */
export function DeleteDepartment({ id, name }: { id: string; name: string }) {
  const [state, formAction, pending] = useActionState(deleteDepartmentAction, initialActionState);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3">
      <FormMessage ok={state.ok} message={state.message} />
      {confirming ? (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <p className="mr-auto text-sm text-foreground">Delete {name}? This can’t be undone.</p>
          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={pending}>
            {pending ? "Deleting…" : "Delete department"}
          </Button>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)} className="text-error">
          <Trash2 aria-hidden className="size-4" />
          Delete department
        </Button>
      )}
    </div>
  );
}
