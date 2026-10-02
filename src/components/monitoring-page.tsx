"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, CircleGauge, Database, RefreshCw, ScanLine, TimerReset, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/skeleton";
import { useDatabaseResource } from "@/hooks/use-database";
import type { OverviewData } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { usePreferences } from "@/store/workspace";

export function MonitoringPage() {
  const refreshSeconds = usePreferences((state) => state.refreshSeconds);
  const queryClient = useQueryClient();
  const { data, isPending, error, connectionId, isFetching } = useDatabaseResource<OverviewData>("overview", { refetchInterval: refreshSeconds * 1000 });
  if (!connectionId) return <><PageHeader icon={CircleGauge} eyebrow="Operations" title="Monitoring" description="Live statistics from PostgreSQL system views." /><EmptyState title="No database selected" description="Connect a PostgreSQL database to inspect live metrics." action="Open connections" href="/connections" /></>;
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <EmptyState title="Monitoring unavailable" description={error?.message ?? "PostgreSQL statistics could not be read."} />;
  const scanData = [{ name: "Sequential", value: data.stats.sequentialScans }, { name: "Index", value: data.stats.indexScans }];
  const relationData = data.largestTables.map((table) => ({ name: table.name, size: Math.round(table.size / 1024) }));
  return <div className="page-stack"><PageHeader icon={CircleGauge} eyebrow="Operations" title="Monitoring" description="Point-in-time metrics from pg_stat_database and pg_stat_user_tables." actions={<button className="button secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["database", connectionId, "overview"] })}><RefreshCw className={isFetching ? "spin" : ""} size={14} /> Refresh</button>} />
    <section className="metric-grid"><MonitorMetric icon={Activity} label="Connections" value={String(data.counts.activeConnections)} /><MonitorMetric icon={Zap} label="Transactions" value={data.stats.transactions.toLocaleString()} /><MonitorMetric icon={Database} label="Database size" value={formatBytes(data.sizeBytes)} /><MonitorMetric icon={TimerReset} label="Cache hit" value={data.stats.cacheHitRatio == null ? "n/a" : `${data.stats.cacheHitRatio}%`} /></section>
    <section className="dashboard-grid"><div className="panel chart-panel"><div className="panel-header"><div><h3>Scan activity</h3><p>Cumulative counters since statistics reset</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={scanData}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--muted-2)", fontSize: 10 }} /><Tooltip contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--border-strong)", borderRadius: 4 }} /><Bar dataKey="value" fill="var(--green)" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div></div><div className="panel chart-panel"><div className="panel-header"><div><h3>Relation storage</h3><p>Largest user tables right now</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={relationData}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} /><YAxis hide /><Tooltip contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--border-strong)", borderRadius: 4 }} formatter={(value) => [`${value} KB`, "Size"]} /><Area dataKey="size" stroke="var(--green)" fill="var(--green-dim)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div></div></section>
    <div className="panel stats-grid"><Stat label="Tuples returned" value={data.stats.tuplesReturned.toLocaleString()} /><Stat label="Sequential scans" value={data.stats.sequentialScans.toLocaleString()} /><Stat label="Index scans" value={data.stats.indexScans.toLocaleString()} /><Stat label="Deadlocks" value={data.stats.deadlocks.toLocaleString()} /><Stat label="PostgreSQL uptime" value={data.uptimeSeconds == null ? "Unavailable" : `${Math.floor(data.uptimeSeconds / 86400)}d ${Math.floor((data.uptimeSeconds % 86400) / 3600)}h`} /><Stat label="Sampled at" value={new Date(data.sampledAt).toLocaleTimeString()} /></div>
    <div className="callout"><ScanLine size={16} /><p>These are real cumulative PostgreSQL counters, not fabricated time-series data. DMS refreshes the current sample every {refreshSeconds} seconds; historical sampling requires persistent metrics storage.</p></div>
  </div>;
}
function MonitorMetric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) { return <div className="metric-card"><div className="metric-icon"><Icon size={17} /></div><div><span>{label}</span><strong>{value}</strong><small>Live PostgreSQL metric</small></div></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
