import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { DashboardRouter } from "@/components/dashboard-router";
import { PageSkeleton } from "@/components/skeleton";

export default async function DashboardPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <AppShell><Suspense fallback={<PageSkeleton />}><DashboardRouter segments={slug} /></Suspense></AppShell>;
}
