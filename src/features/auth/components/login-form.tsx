"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/validation/action-state";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage ok={state.ok} message={state.message} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormField id="email" label="Email" errors={errors.email}>
        <Input
          name="email"
          type="email"
          defaultValue={state.values?.email}
          autoComplete="email"
          required
        />
      </FormField>
      <FormField id="password" label="Password" errors={errors.password}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </FormField>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted">
        New to AgentOS?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Start free
        </Link>
      </p>
    </form>
  );
}
