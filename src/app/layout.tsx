import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "AgentOS — Your AI workforce. One control center.", template: "%s · AgentOS" },
  description:
    "Connect your AI agents, organize them by department, monitor every task, understand token usage and control AI costs from one place.",
};

export const viewport: Viewport = {
  themeColor: "#070D1A",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
