import { Skeleton } from "@/components/ui/skeleton";

export default function AgentsLoading() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6" aria-busy="true" aria-label="Loading agents">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-16 rounded-[18px]" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-20 rounded-[18px]" />
      ))}
    </div>
  );
}
