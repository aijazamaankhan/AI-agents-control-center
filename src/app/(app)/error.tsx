"use client";

import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";

// Error details stay in server logs; users only get a friendly message + retry.
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="mx-auto max-w-2xl">
      <ErrorState title="Unable to load this page." onRetry={reset} />
    </Card>
  );
}
