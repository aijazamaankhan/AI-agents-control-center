"use client";

import { KeyRound, LogOut, Save } from "lucide-react";
import { useActionState } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/validation/action-state";
import { changePasswordAction, signOutOthersAction, updateProfileAction } from "../actions";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, initialActionState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage ok={state.ok} message={state.message} />
      <FormField id="profile-name" label="Full name" errors={e.name}>
        <Input name="name" defaultValue={state.values?.name ?? name} required maxLength={100} />
      </FormField>
      <FormField id="profile-email" label="Email" hint="Email changes aren't supported yet.">
        <Input value={email} disabled readOnly />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Save aria-hidden className="size-4" /> {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initialActionState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage ok={state.ok} message={state.message} />
      <FormField id="pw-current" label="Current password" errors={e.currentPassword}>
        <Input name="currentPassword" type="password" autoComplete="current-password" required />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="pw-new"
          label="New password"
          hint="At least 10 characters."
          errors={e.newPassword}
        >
          <Input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
          />
        </FormField>
        <FormField id="pw-confirm" label="Confirm new password" errors={e.confirmPassword}>
          <Input name="confirmPassword" type="password" autoComplete="new-password" required />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <KeyRound aria-hidden className="size-4" /> {pending ? "Changing…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}

export function SignOutOthersButton() {
  const [state, action, pending] = useActionState(signOutOthersAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <FormMessage ok={state.ok} message={state.message} />
      <Button type="submit" variant="secondary" disabled={pending}>
        <LogOut aria-hidden className="size-4" />{" "}
        {pending ? "Signing out…" : "Sign out all other sessions"}
      </Button>
    </form>
  );
}
