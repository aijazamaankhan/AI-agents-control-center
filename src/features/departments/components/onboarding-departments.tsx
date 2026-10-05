"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { FormMessage } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DepartmentIcon } from "@/features/workforce/components/department-icon";
import { departmentAccent, tint } from "@/features/workforce/visuals";
import { initialActionState } from "@/lib/validation/action-state";
import { saveOnboardingDepartmentsAction } from "../actions";
import { DEPARTMENT_NAME_MAX, RECOMMENDED_DEPARTMENTS } from "../schemas";

interface Row {
  key: number;
  name: string;
}

export function OnboardingDepartments() {
  const [state, formAction, pending] = useActionState(
    saveOnboardingDepartmentsAction,
    initialActionState,
  );
  const [rows, setRows] = useState<Row[]>(() =>
    RECOMMENDED_DEPARTMENTS.map((name, key) => ({ key, name })),
  );
  const [nextKey, setNextKey] = useState<number>(RECOMMENDED_DEPARTMENTS.length);
  const [draft, setDraft] = useState("");
  const addId = useId();

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    setRows((r) => [...r, { key: nextKey, name }]);
    setNextKey((k) => k + 1);
    setDraft("");
  };

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage ok={state.ok} message={state.message} />
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Departments to create">
        {rows.map((row, i) => {
          const accent = departmentAccent(row.name || "x", i);
          return (
            <li
              key={row.key}
              className="flex items-center gap-2 rounded-card border border-border bg-raised/60 p-2"
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-control"
                style={{ background: tint(accent, 14), color: accent }}
              >
                <DepartmentIcon name={row.name} className="size-4" />
              </span>
              <Input
                name="department"
                aria-label={`Department ${i + 1} name`}
                value={row.name}
                maxLength={DEPARTMENT_NAME_MAX}
                onChange={(e) =>
                  setRows((r) =>
                    r.map((x) => (x.key === row.key ? { ...x, name: e.target.value } : x)),
                  )
                }
                className="h-8 border-transparent bg-transparent px-1 focus:bg-raised"
              />
              <button
                type="button"
                aria-label={`Remove ${row.name || "department"}`}
                onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                className="flex size-8 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface hover:text-error"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <label htmlFor={addId} className="sr-only">
          Add a custom department
        </label>
        <Input
          id={addId}
          value={draft}
          maxLength={DEPARTMENT_NAME_MAX}
          placeholder="Add a custom department, e.g. Inventory"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" onClick={add} disabled={!draft.trim()}>
          <Plus aria-hidden className="size-4" /> Add
        </Button>
      </div>

      <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
        <Link href="/dashboard" className={buttonStyles("ghost", "md")}>
          Skip for now
        </Link>
        <Button type="submit" disabled={pending || rows.every((r) => !r.name.trim())}>
          {pending ? "Creating…" : `Create ${rows.filter((r) => r.name.trim()).length} departments`}
        </Button>
      </div>
    </form>
  );
}
