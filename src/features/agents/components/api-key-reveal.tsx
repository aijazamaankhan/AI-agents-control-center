"use client";

import { Check, Copy, KeyRound, TriangleAlert } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-border bg-raised px-2.5 py-1.5 text-xs text-muted hover:text-foreground"
    >
      {copied ? (
        <Check aria-hidden className="size-3.5 text-primary" />
      ) : (
        <Copy aria-hidden className="size-3.5" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

/** One-time display of a freshly issued agent API key. */
export function ApiKeyReveal({ apiKey, agentId }: { apiKey: string; agentId: string }) {
  const snippet = `AGENTOS_API_KEY=${apiKey}\nAGENTOS_AGENT_ID=${agentId}`;
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-control border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        Copy this API key now — it won’t be shown again. Store it as a secret in your agent’s
        environment.
      </div>
      <div className="flex items-center gap-2 rounded-control border border-border bg-background p-2">
        <KeyRound aria-hidden className="ml-1 size-4 shrink-0 text-primary" />
        <code
          data-testid="api-key"
          className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
        >
          {apiKey}
        </code>
        <CopyButton value={apiKey} />
      </div>
      <div className="rounded-control border border-primary/30 bg-primary/5 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] tracking-wide text-primary uppercase">
            Try it now — run the demo agent
          </span>
          <CopyButton value={`npm run demo:agent -- --key ${apiKey}`} label="Copy command" />
        </div>
        <pre className="scroller-x font-mono text-xs leading-5 text-foreground">{`npm run demo:agent -- --key ${apiKey}`}</pre>
        <p className="mt-2 text-xs text-muted">
          Run it in a second terminal in the project folder. It reports tasks, model calls and tool
          calls with this key, so the dashboard comes alive.
        </p>
      </div>
      <div className="rounded-control border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] tracking-wide text-muted uppercase">
            .env for your agent
          </span>
          <CopyButton value={snippet} label="Copy .env" />
        </div>
        <pre className="scroller-x font-mono text-xs leading-5 text-foreground">{snippet}</pre>
      </div>
    </div>
  );
}
