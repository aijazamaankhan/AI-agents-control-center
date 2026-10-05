import { Skeleton } from "@/components/ui/skeleton";

export default function AgentLoading() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6" aria-busy="true" aria-label="Loading agent">
      <Skeleton className="h-5 w-24" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="h-8 w-72" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}
