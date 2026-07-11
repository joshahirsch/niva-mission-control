import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardView />
    </Suspense>
  );
}
