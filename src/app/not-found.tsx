import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        The page you are looking for doesn&apos;t exist or has moved.
      </p>
      <Link href="/" className={buttonStyles("secondary", "md", "mt-6")}>
        Back to AgentOS
      </Link>
    </div>
  );
}
