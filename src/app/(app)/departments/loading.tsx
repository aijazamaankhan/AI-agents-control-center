import { Skeleton } from "@/components/ui/skeleton";

export default function DepartmentsLoading() {
  return (
    <div
      className="mx-auto max-w-[1400px] space-y-6"
      aria-busy="true"
      aria-label="Loading departments"
    >
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-28 rounded-[22px]" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-52 rounded-[20px]" />
        ))}
      </div>
    </div>
  );
}
