import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label="Loading settings">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-96 rounded-card" />
    </div>
  );
}
