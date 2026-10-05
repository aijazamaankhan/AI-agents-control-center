import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { STUDIO } from "@/config/site";
import {
  BookDemoTrigger,
  ServiceInquiryTrigger,
} from "@/features/inquiries/components/inquiry-dialogs";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Workforce map", href: "#product" },
      { label: "Features", href: "#features" },
      { label: "Security", href: "#security" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Start free", href: "/signup" },
      { label: "Company sign in", href: "/login" },
      { label: "Velorex admin sign in", href: "/admin/login" },
      { label: "Developers & SDK", href: "#developers" },
      { label: "How it works", href: "#how-it-works" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border bg-surface/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted">
            Your AI workforce. One control center. Connect, organize, monitor and control every AI
            agent your company runs.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h2 className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
              {col.title}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.href.startsWith("/") ? (
                    <Link href={l.href} className="text-sm text-muted hover:text-foreground">
                      {l.label}
                    </Link>
                  ) : (
                    <a href={l.href} className="text-sm text-muted hover:text-foreground">
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h2 className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">Contact</h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <BookDemoTrigger className="text-sm text-muted hover:text-foreground">
                Book a demo
              </BookDemoTrigger>
            </li>
            <li>
              <ServiceInquiryTrigger className="text-sm text-muted hover:text-foreground">
                Development & design enquiries
              </ServiceInquiryTrigger>
            </li>
            <li>
              <a
                href={`mailto:${STUDIO.email}`}
                className="text-sm break-all text-muted hover:text-foreground"
              >
                {STUDIO.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 text-xs text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} AgentOS. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-1">
            <span>Designed & developed by {STUDIO.developer} ·</span>
            <ServiceInquiryTrigger className="group inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {STUDIO.name} — {STUDIO.descriptor}
              <ArrowUpRight
                aria-hidden
                className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </ServiceInquiryTrigger>
          </div>
        </div>
      </div>
    </footer>
  );
}
