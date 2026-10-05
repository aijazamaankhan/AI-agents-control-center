import { PROVIDER_STYLE, tint } from "@/features/workforce/visuals";
import { cn } from "@/lib/utils";

export function providerStyle(provider: string) {
  return (
    PROVIDER_STYLE[provider] ?? {
      label: provider.charAt(0).toUpperCase() || "?",
      color: "var(--color-purple)",
    }
  );
}

export function AgentAvatar({ provider, size = "md" }: { provider: string; size?: "md" | "lg" }) {
  const p = providerStyle(provider);
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border font-bold",
        size === "lg" ? "size-14 text-lg" : "size-9 text-xs",
      )}
      style={{ borderColor: tint(p.color, 40), color: p.color, background: tint(p.color, 8) }}
    >
      {p.label}
    </span>
  );
}
