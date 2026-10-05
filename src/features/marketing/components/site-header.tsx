"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { buttonStyles } from "@/components/ui/button";

const SECTIONS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#developers", label: "Developers" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors ${scrolled || open ? "border-b border-border bg-background/85 backdrop-blur-md" : "border-b border-transparent"}`}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="AgentOS home">
          <Logo />
        </Link>
        <nav aria-label="Site" className="hidden flex-1 items-center gap-1 lg:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="rounded-control px-3 py-2 text-sm text-muted hover:text-foreground"
            >
              {s.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <Link href="/login" className={buttonStyles("ghost", "sm")}>
            Sign in
          </Link>
          <Link href="/signup" className={buttonStyles("primary", "sm")}>
            Start Free
          </Link>
        </div>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-site-menu"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex size-10 items-center justify-center rounded-control text-muted hover:bg-raised hover:text-foreground sm:ml-0 lg:hidden"
        >
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        </button>
      </div>
      {open ? (
        <nav
          id="mobile-site-menu"
          aria-label="Site"
          className="border-t border-border px-4 pt-2 pb-4 lg:hidden"
        >
          <ul className="grid gap-1">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-control px-3 py-2.5 text-sm text-muted hover:bg-raised hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
            <Link href="/login" className={buttonStyles("secondary", "md")}>
              Sign in
            </Link>
            <Link href="/signup" className={buttonStyles("primary", "md")}>
              Start Free
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
