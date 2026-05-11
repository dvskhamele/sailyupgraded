import { Skeleton } from "@/components/ui/skeleton";

export default function ZenithLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="rounded-md border p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-72" />
        <div className="mt-6 rounded-md border p-4">
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
