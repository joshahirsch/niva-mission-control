import { Suspense, type ReactNode } from "react";
import { TopNavigation } from "./top-navigation";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div className="h-14 border-b border-border" />}>
        <TopNavigation />
      </Suspense>
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:py-10">{children}</main>
    </div>
  );
}
