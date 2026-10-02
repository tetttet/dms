import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { DashboardRouter } from "@/components/dashboard-router";
import { PageSkeleton } from "@/components/skeleton";

export default function HomePage() {
  return <AppShell><Suspense fallback={<PageSkeleton />}><DashboardRouter /></Suspense></AppShell>;
}
