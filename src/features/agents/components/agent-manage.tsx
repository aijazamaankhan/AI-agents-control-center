"use client";

import { KeyRound, Save, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CapabilityRule } from "@/generated/prisma/enums";
import { initialActionState } from "@/lib/validation/action-state";
import { deleteAgentAction, rotateApiKeyAction, updateCapabilitiesAction } from "../actions";
import { ApiKeyReveal } from "./api-key-reveal";
import { CapabilityEditor } from "./capability-editor";

export function CapabilitiesForm({
  agentId,
  initial,
}: {
  agentId: string;
  initial: { label: string; rule: CapabilityRule }[];
}) {
  const [state, action, pending] = useActionState(updateCapabilitiesAction, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="agentId" value={agentId} />
      <FormMessage ok={state.ok} message={state.message} />
      <CapabilityEditor initial={initial} />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Save aria-hidden className="size-4" /> {pending ? "Saving…" : "Save permissions"}
        </Button>
      </div>
    </form>
  );
}

export function RotateApiKey({ agentId }: { agentId: string }) {
  const [state, action, pending] = useActionState(rotateApiKeyAction, initialActionState);
  const [confirming, setConfirming] = useState(false);
  if (state.ok && state.data?.apiKey) {
    return (
      <div className="space-y-3">
        <FormMessage ok message={state.message} />
        <ApiKeyReveal apiKey={state.data.apiKey} agentId={agentId} />
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="agentId" value={agentId} />
      <FormMessage ok={false} message={state.message} />
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm text-foreground">
            The current key stops working immediately.
          </p>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Rotating…" : "Rotate key"}
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          <KeyRound aria-hidden className="size-4" /> Rotate API key
        </Button>
      )}
    </form>
  );
}

export function DeleteAgent({ agentId, name }: { agentId: string; name: string }) {
  const [state, action, pending] = useActionState(deleteAgentAction, initialActionState);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-3">
      <FormMessage ok={false} message={state.message} />
      {confirming ? (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="agentId" value={agentId} />
          <p className="mr-auto text-sm text-foreground">
            Delete {name}? Its API key stops working.
          </p>
          <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" disabled={pending}>
            {pending ? "Deleting…" : "Delete agent"}
          </Button>
        </form>
      ) : (
        <Button variant="secondary" className="text-error" onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden className="size-4" /> Delete agent
        </Button>
      )}
    </div>
  );
}
