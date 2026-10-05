"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "./button";

/** Friendly error with retry. Never renders raw error details. */
export function ErrorState({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-card border border-error/30 bg-error/10">
        <TriangleAlert aria-hidden className="size-5 text-error" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted">
        Please try again. If the problem continues, contact support.
      </p>
      {onRetry ? (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Try Again
        </Button>
      ) : null}
    </div>
  );
}
