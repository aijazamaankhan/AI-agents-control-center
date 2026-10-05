"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/validation/action-state";
import { loginAction } from "../actions";

interface LoginFormProps {
  next?: string;
  /** Local development only: credentials of the seeded demo owner account. */
  demo?: { email: string; password: string };
}

export function LoginForm({ next, demo }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialActionState);
  const errors = state.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  const fillDemo = () => {
    const form = formRef.current;
    if (!form || !demo) return;
    (form.elements.namedItem("email") as HTMLInputElement).value = demo.email;
    (form.elements.namedItem("password") as HTMLInputElement).value = demo.password;
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {demo ? (
        <div className="rounded-control border border-primary/30 bg-primary/10 p-3 text-sm">
          <p className="font-medium text-foreground">Local demo account (owner, full access)</p>
          <p className="mt-1 font-mono text-xs text-muted">
            {demo.email} · {demo.password}
          </p>
          <button
            type="button"
            onClick={fillDemo}
            className="mt-2 text-xs font-semibold text-primary hover:underline"
          >
            Use demo account →
          </button>
          <p className="mt-1 text-[11px] text-muted">Shown only in development.</p>
        </div>
      ) : null}
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
