import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

interface FormFieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  errors?: string[];
  children: ReactElement<Record<string, unknown>>;
}

/** Label + control + hint/errors, wired with aria attributes. */
export function FormField({ id, label, hint, errors, children }: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const hasError = Boolean(errors?.length);
  const describedBy =
    [hint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {isValidElement(children)
        ? cloneElement(children, {
            id,
            "aria-invalid": hasError || undefined,
            "aria-describedby": describedBy,
          })
        : children}
      {hint && !hasError ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} role="alert" className="text-xs text-error">
          {errors![0]}
        </p>
      ) : null}
    </div>
  );
}
