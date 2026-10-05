"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { initialActionState } from "@/lib/validation/action-state";
import { adminLoginAction, loginAction } from "../actions";

interface DemoLogin {
  label: string;
  email: string;
  password: string;
}

interface LoginFormProps {
  next?: string;
  /** "admin" signs in to the Velorex Studio admin panel and rejects non-admin accounts. */
  variant?: "company" | "admin";
  /** Local development only: seeded demo logins (docs/LOGINS.md) offered as quick-fill. */
  demoLogins?: DemoLogin[];
}

export function LoginForm({ next, variant = "company", demoLogins = [] }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    variant === "admin" ? adminLoginAction : loginAction,
    initialActionState,
  );
  const errors = state.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  const fill = (login: DemoLogin) => {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("email") as HTMLInputElement).value = login.email;
    (form.elements.namedItem("password") as HTMLInputElement).value = login.password;
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {demoLogins.length > 0 ? (
        <div className="rounded-control border border-primary/30 bg-primary/10 p-3 text-sm">
          <p className="font-medium text-foreground">Local demo logins</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Click one to fill the form. Shown only in development — see docs/LOGINS.md.
          </p>
          <ul className="mt-2 space-y-1">
            {demoLogins.map((login) => (
              <li key={login.email}>
                <button
                  type="button"
                  onClick={() => fill(login)}
                  className="flex w-full flex-wrap items-baseline justify-between gap-x-3 rounded-control px-2 py-1 text-left hover:bg-primary/15"
                  aria-label={`Use ${login.label} login`}
                >
                  <span className="text-xs font-semibold text-primary capitalize">
                    {login.label}
                  </span>
                  <span className="font-mono text-[11px] text-muted">{login.email}</span>
                </button>
              </li>
            ))}
          </ul>
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
        {pending ? "Signing in…" : variant === "admin" ? "Sign in to admin panel" : "Sign in"}
      </Button>
      {variant === "admin" ? (
        <p className="text-center text-sm text-muted">
          Company user?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Company sign in
          </Link>
        </p>
      ) : (
        <div className="space-y-1 text-center text-sm text-muted">
          <p>
            New to AgentOS?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Start free
            </Link>
          </p>
          <p className="text-xs">
            Velorex Studio staff?{" "}
            <Link href="/admin/login" className="font-medium text-orange hover:underline">
              Admin sign in
            </Link>
          </p>
        </div>
      )}
    </form>
  );
}
