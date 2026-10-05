"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

const CODE = `import { AgentOS } from "@agentos/sdk";

const agentos = new AgentOS({ apiKey: process.env.AGENTOS_API_KEY });

const task = await agentos.task.start({ name: "Find SaaS leads" });

await agentos.llm.call({
  provider: "anthropic",
  model: "claude-sonnet",
  inputTokens: 12430,
  outputTokens: 2840,
});

await agentos.tool.call({ name: "web_search" });

await task.complete({ result: { leadsFound: 47 } });`;

function highlight(line: string) {
  // Tiny, safe highlighter: strings, numbers, keywords — no HTML injection (React text nodes).
  const parts: { text: string; cls?: string }[] = [];
  const re = /("[^"]*"|\b\d+\b|\b(?:import|from|const|await|new)\b)/g;
  let last = 0;
  for (const m of line.matchAll(re)) {
    if (m.index! > last) parts.push({ text: line.slice(last, m.index) });
    const t = m[0];
    parts.push({
      text: t,
      cls: t.startsWith('"') ? "text-lime" : /^\d/.test(t) ? "text-orange" : "text-purple",
    });
    last = m.index! + t.length;
  }
  if (last < line.length) parts.push({ text: line.slice(last) });
  return parts;
}

export function CodeSample() {
  const [copied, setCopied] = useState(false);

  return (
    <div className="overflow-hidden rounded-[20px] border border-border bg-[#07090a]">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-error/70" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-primary/70" />
        </div>
        <span className="font-mono text-xs text-muted">agent.ts</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(CODE);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              setCopied(false);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-xs text-muted hover:bg-raised hover:text-foreground"
        >
          {copied ? (
            <Check aria-hidden className="size-3.5 text-primary" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scroller-x p-5 font-mono text-[13px] leading-6 text-foreground">
        <code>
          {CODE.split("\n").map((line, i) => (
            <span key={i} className="block">
              <span
                aria-hidden
                className="mr-4 inline-block w-5 text-right text-muted/40 select-none"
              >
                {i + 1}
              </span>
              {highlight(line).map((p, j) => (
                <span key={j} className={p.cls}>
                  {p.text}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
