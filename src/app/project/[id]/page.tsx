"use client";

import { useParams } from "next/navigation";
import { useProject } from "@/lib/hooks/use-projects";
import { ProjectDetail } from "@/components/detail/project-detail";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-8 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, isError, error, refetch } = useProject(id);

  if (isLoading) return <DetailSkeleton />;
  if (isError) return <ErrorState message={(error as Error)?.message ?? "Unknown error"} onRetry={() => refetch()} />;
  if (!project) return <ErrorState message="This initiative could not be found." />;

  return <ProjectDetail project={project} />;
}
