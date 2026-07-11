import { Skeleton } from "./skeleton";
import { Card, CardContent, CardHeader } from "./card";

export function MetricSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-16" />
      </CardContent>
    </Card>
  );
}

export function ProjectCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-1.5 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <MetricSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
