import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Create company", "Departments", "Connect agent", "Invite team", "Dashboard"];

export function OnboardingSteps({ current }: { current: number }) {
  return (
    <ol aria-label="Onboarding steps" className="mt-10 flex flex-wrap gap-x-5 gap-y-2">
      {STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === current ? "step" : undefined}
          className={cn(
            "flex items-center gap-2 text-xs",
            i <= current ? "text-foreground" : "text-muted",
          )}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold",
              i < current && "border-primary bg-primary/15 text-primary",
              i === current && "border-primary bg-primary text-background",
              i > current && "border-border",
            )}
          >
            {i < current ? <Check aria-hidden className="size-3" strokeWidth={3} /> : i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}
