import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { robots: { index: false } };

/** Bare layout for the desktop app's small pop-up windows (no sidebar or top bar). */
export default function PopupLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background p-3 sm:p-4">{children}</div>;
}
