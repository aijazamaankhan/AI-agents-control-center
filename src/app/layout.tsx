import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "AgentOS — Your AI workforce. One control center.", template: "%s · AgentOS" },
  description:
    "Connect your AI agents, organize them by department, monitor every task, understand token usage and control AI costs from one place.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050607" },
    { media: "(prefers-color-scheme: light)", color: "#f4f7f5" },
  ],
  colorScheme: "dark light",
};

// Runs before first paint so the chosen theme never flashes. Default: dark.
const themeScript = `try{var t=localStorage.getItem("agentos-theme")||"dark",r=document.documentElement;if(t==="system")r.removeAttribute("data-theme");else r.setAttribute("data-theme",t==="light"?"light":"dark")}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable}`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
