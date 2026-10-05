"use client";

import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import type { CapabilityRule } from "@/generated/prisma/enums";
import { RULE_STYLE } from "../rule-style";
import { CAPABILITY_PRESETS, CAPABILITY_RULES, capabilityKey, MAX_CAPABILITIES } from "../schemas";

export interface CapabilityRow {
  label: string;
  rule: CapabilityRule;
}

/** Controlled list of capability rules, serialized into a hidden `capabilities` field. */
export function CapabilityEditor({ initial = [] }: { initial?: CapabilityRow[] }) {
  const [rows, setRows] = useState<CapabilityRow[]>(initial);
  const [draft, setDraft] = useState("");
  const draftId = useId();
  const keys = new Set(rows.map((r) => capabilityKey(r.label)));
  const full = rows.length >= MAX_CAPABILITIES;

  const add = (label: string, rule: CapabilityRule = "ALLOWED") => {
    const clean = label.trim();
    if (!clean || keys.has(capabilityKey(clean)) || full) return;
    setRows((r) => [...r, { label: clean, rule }]);
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name="capabilities" value={JSON.stringify(rows)} />
      {rows.length ? (
        <ul className="space-y-2" aria-label="Capabilities">
          {rows.map((row, i) => (
            <li
              key={`${row.label}-${i}`}
              className="flex items-center gap-2 rounded-control border border-border bg-raised/60 p-1.5 pl-3"
            >
              <span
                aria-hidden
                className="w-4 text-center text-sm font-bold"
                style={{ color: RULE_STYLE[row.rule].color }}
              >
                {RULE_STYLE[row.rule].symbol}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{row.label}</span>
              <Select
                aria-label={`Rule for ${row.label}`}
                value={row.rule}
                onChange={(e) =>
                  setRows((r) =>
                    r.map((x, j) =>
                      j === i ? { ...x, rule: e.target.value as CapabilityRule } : x,
                    ),
                  )
                }
                className="h-8 w-40 text-xs"
              >
                {CAPABILITY_RULES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                aria-label={`Remove ${row.label}`}
                onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                className="flex size-8 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-error"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No capabilities yet — add what this agent may do.</p>
      )}

      <div className="flex flex-wrap gap-1.5" aria-label="Suggested capabilities">
        {CAPABILITY_PRESETS.filter((p) => !keys.has(capabilityKey(p.label))).map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={full}
            onClick={() => add(p.label, p.rule)}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-primary/50 hover:text-foreground disabled:opacity-50"
          >
            <Plus aria-hidden className="size-3" /> {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <label htmlFor={draftId} className="sr-only">
          Custom capability
        </label>
        <Input
          id={draftId}
          value={draft}
          maxLength={80}
          placeholder="Custom capability, e.g. Update inventory"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
              setDraft("");
            }
          }}
        />
        <Button
          variant="secondary"
          disabled={!draft.trim() || full}
          onClick={() => {
            add(draft);
            setDraft("");
          }}
        >
          <Plus aria-hidden className="size-4" /> Add
        </Button>
      </div>
    </div>
  );
}
