import { Skeleton } from "@/components/ui/skeleton";

export default function DepartmentLoading() {
  return (
    <div
      className="mx-auto max-w-[1400px] space-y-6"
      aria-busy="true"
      aria-label="Loading department"
    >
      <Skeleton className="h-5 w-32" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-[18px]" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-[18px]" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-[22px]" />
    </div>
  );
}
