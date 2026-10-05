"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/validation/action-state";
import { createDepartmentAction, updateDepartmentAction } from "../actions";
import { DEPARTMENT_NAME_MAX } from "../schemas";

export function NewDepartmentForm() {
  const [state, formAction, pending] = useActionState(createDepartmentAction, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormMessage ok={state.ok} message={state.message} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
        <FormField id="new-name" label="Department name" errors={errors.name}>
          <Input
            name="name"
            defaultValue={state.values?.name}
            placeholder="e.g. Inventory"
            required
            maxLength={DEPARTMENT_NAME_MAX}
          />
        </FormField>
        <FormField id="new-description" label="Description (optional)" errors={errors.description}>
          <Input
            name="description"
            defaultValue={state.values?.description}
            placeholder="What do agents in this department do?"
            maxLength={280}
          />
        </FormField>
        <Button type="submit" disabled={pending} className="sm:mb-0">
          <Plus aria-hidden className="size-4" />
          {pending ? "Adding…" : "Add department"}
        </Button>
      </div>
    </form>
  );
}

export function EditDepartmentForm({
  id,
  name,
  description,
}: {
  id: string;
  name: string;
  description: string;
}) {
  const [state, formAction, pending] = useActionState(updateDepartmentAction, initialActionState);
  const errors = state.fieldErrors ?? {};
  const values = { name, description, ...state.values };

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormMessage ok={state.ok} message={state.message} />
      <input type="hidden" name="id" value={id} />
      <FormField id="edit-name" label="Name" errors={errors.name}>
        <Input name="name" defaultValue={values.name} required maxLength={DEPARTMENT_NAME_MAX} />
      </FormField>
      <FormField id="edit-description" label="Description" errors={errors.description}>
        <Input name="description" defaultValue={values.description} maxLength={280} />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
