import { cn } from "@/lib/utils";

export function Logo({
  className,
  withWordmark = true,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="flex size-8 items-center justify-center rounded-control bg-gradient-to-br from-primary to-purple text-sm font-bold text-white"
      >
        A
      </span>
      {withWordmark ? (
        <span className="text-sm font-semibold tracking-[0.18em] text-foreground">AGENTOS</span>
      ) : null}
    </span>
  );
}
