"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Native <dialog> (focus trap, Esc, inert background), portalled to <body> and
 * mounted only while open — so a trigger may live anywhere (even inside a <p>)
 * without producing invalid HTML or a hydration mismatch.
 */
export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  if (!open) return null;
  return createPortal(
    <ModalDialog onClose={onClose} title={title} description={description} className={className}>
      {children}
    </ModalDialog>,
    document.body,
  );
}

function ModalDialog({
  onClose,
  title,
  description,
  children,
  className,
}: Omit<ModalProps, "open">) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    // No cleanup: calling close() there would fire onClose during React Strict Mode's
    // dev-only remount and dismiss the dialog instantly. Unmounting removes it anyway.
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on backdrop
      }}
      className={cn(
        "m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-[22px] border border-border bg-surface p-0 text-foreground shadow-2xl shadow-black/60",
        "backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        className,
      )}
    >
      <div className="p-6 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-sm text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-foreground"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
