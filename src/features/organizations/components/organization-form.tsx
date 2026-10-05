"use client";

import { useActionState, useSyncExternalStore } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select } from "@/components/ui/input";
import { initialActionState, type ActionState } from "@/lib/validation/action-state";
import { COMPANY_SIZES, INDUSTRIES } from "../constants";

export interface OrganizationFormValues {
  name: string;
  industry: string;
  companySize: string;
  country: string;
  timezone: string;
}

interface OrganizationFormProps {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  countries: { value: string; label: string }[];
  timezones: string[];
  defaultValues?: OrganizationFormValues;
  submitLabel: string;
  pendingLabel: string;
  readOnly?: boolean;
}

const noopSubscribe = () => () => {};
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function OrganizationForm({
  action,
  countries,
  timezones,
  defaultValues,
  submitLabel,
  pendingLabel,
  readOnly = false,
}: OrganizationFormProps) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const errors = state.fieldErrors ?? {};
  // After a submit, React resets the form to defaultValue — prefer the echoed submission.
  const values: Partial<OrganizationFormValues> = { ...defaultValues, ...state.values };
  // Server renders without a timezone guess; the client re-keys the select with the browser's zone.
  const detectedTz = useSyncExternalStore(noopSubscribe, browserTimezone, () => null);
  const tzDefault = values.timezone || detectedTz || "UTC";
  // The runtime list may name a zone by its alias (Asia/Calcutta); keep the actual value selectable.
  const tzOptions = timezones.includes(tzDefault) ? timezones : [tzDefault, ...timezones];
  const disabled = readOnly || pending;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage ok={state.ok} message={state.message} />
      <FormField id="name" label="Company name" errors={errors.name}>
        <Input
          name="name"
          defaultValue={values.name}
          required
          maxLength={100}
          disabled={disabled}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="industry" label="Industry" errors={errors.industry}>
          <Select name="industry" defaultValue={values.industry ?? ""} required disabled={disabled}>
            <option value="" disabled>
              Select industry
            </option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="companySize" label="Company size" errors={errors.companySize}>
          <Select
            name="companySize"
            defaultValue={values.companySize ?? ""}
            required
            disabled={disabled}
          >
            <option value="" disabled>
              Select size
            </option>
            {COMPANY_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} employees
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="country" label="Country" errors={errors.country}>
          <Select name="country" defaultValue={values.country ?? ""} required disabled={disabled}>
            <option value="" disabled>
              Select country
            </option>
            {countries.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="timezone" label="Timezone" errors={errors.timezone}>
          <Select
            key={tzDefault}
            name="timezone"
            defaultValue={tzDefault}
            required
            disabled={disabled}
          >
            {tzOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {readOnly ? null : (
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
