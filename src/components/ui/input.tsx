import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "h-10 w-full rounded-control border border-border bg-raised px-3 text-sm text-foreground placeholder:text-muted/70 " +
  "transition-colors focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 " +
  "aria-invalid:border-error";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(fieldBase, className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(fieldBase, "appearance-auto", className)} {...props}>
        {children}
      </select>
    );
  },
);
