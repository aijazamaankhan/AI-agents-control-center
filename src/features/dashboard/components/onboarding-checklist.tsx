import { CircleCheck, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChecklistItem } from "../server/dashboard-service";

export function OnboardingChecklist({ items }: { items: ChecklistItem[] }) {
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Get started</CardTitle>
          <CardDescription>
            {done} of {items.length} complete
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mb-4 h-1.5 overflow-hidden rounded-full bg-raised"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2.5 text-sm">
              {item.done ? (
                <CircleCheck aria-hidden className="size-4 text-success" />
              ) : (
                <Circle aria-hidden className="size-4 text-muted" />
              )}
              <span className={item.done ? "text-foreground" : "text-muted"}>{item.label}</span>
              <span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
