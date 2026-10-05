"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/validation/action-state";
import { signupAction } from "../actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage ok={state.ok} message={state.message} />
      <FormField id="name" label="Full name" errors={errors.name}>
        <Input
          name="name"
          defaultValue={state.values?.name}
          autoComplete="name"
          required
          maxLength={100}
        />
      </FormField>
      <FormField id="email" label="Work email" errors={errors.email}>
        <Input
          name="email"
          type="email"
          defaultValue={state.values?.email}
          autoComplete="email"
          required
        />
      </FormField>
      <FormField
        id="password"
        label="Password"
        hint="At least 10 characters."
        errors={errors.password}
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
        />
      </FormField>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
