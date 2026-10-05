"use client";

import { ArrowRight, Bot, LoaderCircle, Plug, PlugZap, Plus } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { CapabilityRule, ConnectionType, EndpointAuthType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { initialActionState } from "@/lib/validation/action-state";
import { createAgentAction, testConnectionAction, updateAgentAction } from "../actions";
import { AUTH_TYPES, CONNECTION_TYPES, MODEL_SUGGESTIONS, PROVIDERS } from "../schemas";
import { ApiKeyReveal } from "./api-key-reveal";
import { CapabilityEditor } from "./capability-editor";

export interface AgentFormDefaults {
  id: string;
  name: string;
  description: string;
  departmentId: string;
  provider: string;
  model: string;
  connectionType: ConnectionType;
  endpointUrl: string | null;
  authType: EndpointAuthType;
  authHeaderName: string | null;
  credentialHint: string | null;
}

interface AgentFormProps {
  mode: "create" | "edit";
  departments: { id: string; name: string }[];
  agent?: AgentFormDefaults;
  defaultDepartmentId?: string;
  initialCapabilities?: { label: string; rule: CapabilityRule }[];
}

function Section({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-border bg-surface p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 font-display text-sm font-medium text-primary">
          {step}
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function AgentForm({
  mode,
  departments,
  agent,
  defaultDepartmentId,
  initialCapabilities,
}: AgentFormProps) {
  const [state, formAction, pending] = useActionState(
    mode === "create" ? createAgentAction : updateAgentAction,
    initialActionState,
  );
  const [testState, testDispatch, testing] = useActionState(
    testConnectionAction,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const v: Partial<Record<string, string>> = {
    ...(agent
      ? {
          name: agent.name,
          description: agent.description,
          departmentId: agent.departmentId,
          provider: agent.provider,
          model: agent.model,
          endpointUrl: agent.endpointUrl ?? "",
          authHeaderName: agent.authHeaderName ?? "",
        }
      : { departmentId: defaultDepartmentId ?? "" }),
    ...state.values,
  };
  const [connectionType, setConnectionType] = useState<ConnectionType>(
    agent?.connectionType ?? "SDK",
  );
  const [authType, setAuthType] = useState<EndpointAuthType>(agent?.authType ?? "NONE");
  const [provider, setProvider] = useState<string>(agent?.provider ?? "Anthropic");
  const e = { ...(testState.fieldErrors ?? {}), ...(state.fieldErrors ?? {}) };
  const typeDef = CONNECTION_TYPES.find((t) => t.value === connectionType)!;
  const hasStoredSecret = mode === "edit" && agent?.credentialHint && agent.authType === authType;

  if (mode === "create" && state.ok && state.data?.apiKey && state.data.agentId) {
    return (
      <div className="mx-auto max-w-2xl rounded-[22px] border border-primary/30 bg-surface p-6 sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <PlugZap aria-hidden className="size-6" />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-foreground">
          ✓ {state.data.name} connected
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          Agent ID <code className="font-mono text-foreground">{state.data.agentId}</code>. It shows
          as <strong className="text-foreground">Offline</strong> until it sends its first heartbeat
          or event with this key.
        </p>
        <ApiKeyReveal apiKey={state.data.apiKey} agentId={state.data.agentId} />
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href={`/agents/${state.data.agentId}`} className={buttonStyles("primary", "md")}>
            Open agent <ArrowRight aria-hidden className="size-4" />
          </Link>
          {/* We're on /agents/new already: a reload gives a fresh, empty form. */}
          <Button variant="secondary" onClick={() => window.location.reload()}>
            <Plus aria-hidden className="size-4" /> Connect another agent
          </Button>
        </div>
      </div>
    );
  }

  const runTest = () => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    startTransition(() => testDispatch(fd));
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-5" noValidate>
      {agent ? <input type="hidden" name="agentId" value={agent.id} /> : null}
      <FormMessage ok={state.ok} message={state.message} />

      <Section
        step={1}
        title="Agent details"
        description="Who this agent is and which team owns it."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="agent-name" label="Agent name" errors={e.name}>
            <Input
              name="name"
              defaultValue={v.name}
              placeholder="Lead Research Agent"
              required
              maxLength={80}
            />
          </FormField>
          <FormField id="agent-department" label="Department" errors={e.departmentId}>
            <Select name="departmentId" defaultValue={v.departmentId ?? ""} required>
              <option value="" disabled>
                Select department
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="agent-provider" label="Provider" errors={e.provider}>
            <Select
              name="provider"
              value={provider}
              onChange={(ev) => setProvider(ev.target.value)}
              required
            >
              {PROVIDERS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </FormField>
          <FormField
            id="agent-model"
            label="Model"
            hint="Pick a suggestion or type any model name."
            errors={e.model}
          >
            <Input
              name="model"
              list="model-suggestions"
              defaultValue={v.model}
              placeholder="Claude Sonnet"
              required
              maxLength={80}
            />
          </FormField>
          <datalist id="model-suggestions">
            {(MODEL_SUGGESTIONS[provider as keyof typeof MODEL_SUGGESTIONS] ?? []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        <div className="mt-4">
          <FormField id="agent-description" label="Description (optional)" errors={e.description}>
            <Textarea
              name="description"
              rows={2}
              defaultValue={v.description}
              maxLength={500}
              placeholder="Finds and qualifies SaaS leads in India."
            />
          </FormField>
        </div>
      </Section>

      <Section step={2} title="Connection" description="How AgentOS talks to this agent.">
        <fieldset>
          <legend className="sr-only">Connection type</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {CONNECTION_TYPES.map((t) => (
              <label
                key={t.value}
                className={cn(
                  "cursor-pointer rounded-card border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary",
                  connectionType === t.value
                    ? "border-primary bg-primary/10"
                    : "border-border bg-raised/50 hover:border-border-strong",
                )}
              >
                <input
                  type="radio"
                  name="connectionType"
                  value={t.value}
                  checked={connectionType === t.value}
                  onChange={() => setConnectionType(t.value)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Plug
                    aria-hidden
                    className={cn(
                      "size-4",
                      connectionType === t.value ? "text-primary" : "text-muted",
                    )}
                  />
                  {t.label}
                </span>
                <span className="mt-1 block text-xs text-muted">{t.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {typeDef.endpoint !== "none" ? (
          <div className="mt-4 space-y-4">
            <FormField
              id="agent-endpoint"
              label={
                typeDef.endpoint === "required" ? "Agent endpoint" : "Agent endpoint (optional)"
              }
              hint="Full URL, e.g. https://agents.acme.com/lead-research"
              errors={e.endpointUrl}
            >
              <Input
                name="endpointUrl"
                type="url"
                defaultValue={v.endpointUrl}
                placeholder="https://"
                maxLength={2048}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="agent-auth" label="Authentication" errors={e.authType}>
                <Select
                  name="authType"
                  value={authType}
                  onChange={(ev) => setAuthType(ev.target.value as EndpointAuthType)}
                >
                  {AUTH_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              {authType === "API_KEY" ? (
                <FormField id="agent-header" label="Header name" errors={e.authHeaderName}>
                  <Input
                    name="authHeaderName"
                    defaultValue={v.authHeaderName || "X-API-Key"}
                    maxLength={64}
                  />
                </FormField>
              ) : null}
              {authType === "BASIC" ? (
                <FormField id="agent-username" label="Username" errors={e.authUsername}>
                  <Input
                    name="authUsername"
                    defaultValue={v.authUsername}
                    autoComplete="off"
                    maxLength={256}
                  />
                </FormField>
              ) : null}
            </div>
            {authType !== "NONE" ? (
              <FormField
                id="agent-secret"
                label={
                  authType === "BASIC" ? "Password" : authType === "API_KEY" ? "API key" : "Token"
                }
                hint={
                  hasStoredSecret
                    ? `Stored securely (${agent?.credentialHint}). Leave blank to keep it.`
                    : "Encrypted at rest. Never shown again after saving."
                }
                errors={e.authSecret}
              >
                <Input
                  name="authSecret"
                  type="password"
                  autoComplete="new-password"
                  maxLength={4096}
                />
              </FormField>
            ) : null}
          </div>
        ) : (
          <>
            <input type="hidden" name="authType" value="NONE" />
            <p className="mt-4 rounded-control border border-border bg-raised/60 px-3 py-2 text-sm text-muted">
              SDK agents don’t need an endpoint. After connecting you’ll get an API key — your agent
              uses it to report tasks, model calls and tool calls.
            </p>
          </>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
          <Button variant="secondary" onClick={runTest} disabled={testing}>
            {testing ? (
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
            ) : (
              <PlugZap aria-hidden className="size-4" />
            )}
            {testing ? "Testing…" : "Test connection"}
          </Button>
          <div className="min-w-0 flex-1" aria-live="polite">
            {testState.message ? (
              <FormMessage ok={testState.ok} message={testState.message} />
            ) : null}
          </div>
        </div>
      </Section>

      {mode === "create" ? (
        <Section
          step={3}
          title="Capabilities & permissions"
          description="What this agent may do, must never do, or needs approval for."
        >
          <CapabilityEditor initial={initialCapabilities} />
        </Section>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          <Bot aria-hidden className="size-4" />
          {pending
            ? mode === "create"
              ? "Connecting…"
              : "Saving…"
            : mode === "create"
              ? "Connect Agent"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
