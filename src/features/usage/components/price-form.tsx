"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/validation/action-state";
import { addPriceAction } from "../actions";

/** Adds a price version (USD per 1M tokens). Prefilled from an "unpriced model" link. */
export function PriceForm({ provider, model }: { provider?: string; model?: string }) {
  const [state, action, pending] = useActionState(addPriceAction, initialActionState);
  const errors = state.fieldErrors ?? {};
  const v = state.ok ? {} : (state.values ?? {});

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage ok={state.ok} message={state.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="provider" label="Provider" errors={errors.provider}>
          <Input
            name="provider"
            defaultValue={v.provider ?? provider}
            placeholder="Anthropic"
            required
          />
        </FormField>
        <FormField id="model" label="Model" errors={errors.model}>
          <Input
            name="model"
            defaultValue={v.model ?? model}
            placeholder="Claude Sonnet"
            required
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="inputPerMtok" label="Input $ / 1M tokens" errors={errors.inputPerMtok}>
          <Input
            name="inputPerMtok"
            inputMode="decimal"
            defaultValue={v.inputPerMtok}
            placeholder="3.00"
            required
          />
        </FormField>
        <FormField id="outputPerMtok" label="Output $ / 1M tokens" errors={errors.outputPerMtok}>
          <Input
            name="outputPerMtok"
            inputMode="decimal"
            defaultValue={v.outputPerMtok}
            placeholder="15.00"
            required
          />
        </FormField>
        <FormField id="cachedPerMtok" label="Cached input $ / 1M" errors={errors.cachedPerMtok}>
          <Input
            name="cachedPerMtok"
            inputMode="decimal"
            defaultValue={v.cachedPerMtok ?? "0"}
            required
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="effectiveFrom"
          label="Effective from (UTC, optional)"
          errors={errors.effectiveFrom}
          hint="Leave empty for “now”. Earlier unpriced calls from this time on get priced."
        >
          <Input name="effectiveFrom" type="datetime-local" defaultValue={v.effectiveFrom} />
        </FormField>
        <FormField id="note" label="Note (optional)" errors={errors.note}>
          <Input
            name="note"
            defaultValue={v.note}
            placeholder="Source: provider price page, Oct 2026"
          />
        </FormField>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add price version"}
      </Button>
    </form>
  );
}
