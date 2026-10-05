"use client";

import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";

/**
 * Users get a friendly message + retry. In development only, the real reason and a fix
 * hint are shown too (production error messages are redacted by Next.js anyway).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dev = process.env.NODE_ENV === "development";
  const schemaOutdated = /does not exist|P2021|P2022|column .* does not exist/i.test(
    error.message ?? "",
  );

  return (
    <Card className="mx-auto max-w-2xl">
      <ErrorState title="Unable to load this page." onRetry={reset} />
      {dev ? (
        <div className="mx-6 mb-6 rounded-control border border-warning/30 bg-warning/10 p-4 text-sm">
          <p className="font-medium text-warning">Developer details (shown only in development)</p>
          {schemaOutdated ? (
            <p className="mt-2 text-foreground">
              Your database is missing tables from a newer version of AgentOS. Stop the app (Ctrl+C)
              and run{" "}
              <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs">npm run dev</code>{" "}
              again — it applies database updates automatically.
            </p>
          ) : null}
          <pre className="scroller-x mt-2 font-mono text-xs whitespace-pre-wrap text-muted">
            {error.message}
          </pre>
        </div>
      ) : null}
    </Card>
  );
}
