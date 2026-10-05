import type { Metadata } from "next";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = { title: "Start free" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-foreground">Create your AgentOS account</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Bring your AI workforce under one control center.
      </p>
      <SignupForm />
    </>
  );
}
