"use client";

import { Construction, ShieldAlert } from "lucide-react";
import { BackupsPage } from "@/components/backups-page";
import { ConnectionsPage } from "@/components/connections-page";
import { EmptyState } from "@/components/empty-state";
import { HistoryPage } from "@/components/history-page";
import { MonitoringPage } from "@/components/monitoring-page";
import { OverviewPage } from "@/components/overview-page";
import { ResourcePage, TablesPage } from "@/components/resource-page";
import { SettingsPage } from "@/components/settings-page";
import { SqlEditorPage } from "@/components/sql-editor-page";
import { TableDetailPage } from "@/components/table-detail-page";
import { PageHeader } from "@/components/page-header";

const resources = ["databases", "schemas", "views", "functions", "indexes", "relationships", "extensions", "roles", "activity"] as const;

export function DashboardRouter({ segments = [] }: { segments?: string[] }) {
  const [section, schema, table] = segments;
  if (!section) return <OverviewPage />;
  if (section === "connections") return <ConnectionsPage />;
  if (section === "sql") return <SqlEditorPage />;
  if (section === "tables" && schema && table) return <TableDetailPage schema={decodeURIComponent(schema)} table={decodeURIComponent(table)} />;
  if (section === "tables") return <TablesPage />;
  if (resources.includes(section as typeof resources[number])) return <ResourcePage resource={section as typeof resources[number]} />;
  if (section === "history") return <HistoryPage />;
  if (section === "query-logs") return <HistoryPage logs />;
  if (section === "monitoring") return <MonitoringPage />;
  if (section === "backups") return <BackupsPage />;
  if (section === "settings") return <SettingsPage />;
  return <div className="page-stack"><PageHeader icon={Construction} eyebrow="DMS" title="Page not found" description="This workspace route does not exist." /><EmptyState icon={ShieldAlert} title="Unknown workspace route" description={`DMS could not resolve /${segments.join("/")}.`} action="Return to overview" href="/" /></div>;
}

