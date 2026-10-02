"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Activity, ArrowRight, Clock3, Database, GitFork, HardDrive, Play, RefreshCw, Server, Table2, TerminalSquare } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/skeleton";
import { formatBytes } from "@/lib/utils";
import type { OverviewData } from "@/lib/types";
import { useDatabaseResource } from "@/hooks/use-database";

export function OverviewPage() {
  const queryClient = useQueryClient();
  const { data, isPending, error, connectionId, connection } = useDatabaseResource<OverviewData>("overview");
  if (!connectionId) return <div className="page-stack"><div className="page-header"><div><h1>Database overview</h1><p>Connect a PostgreSQL database to start managing it.</p></div></div><EmptyState title="No PostgreSQL connections configured" description="Add DATABASE_URL to your local environment or project settings. Credentials remain server-side." action="View setup" href="/connections" /></div>;
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <EmptyState icon={Server} title="Database unavailable" description={error?.message ?? "DMS could not retrieve database metadata."} action="Review connection" href="/connections" />;

  const chartData = data.largestTables.map((table) => ({ name: table.name, size: Math.max(table.size / 1024, 0.1) }));
  return <div className="overview-layout">
    <div className="overview-heading"><div><h1>Database overview</h1><div className="breadcrumbs"><Link href="/connections">Connections</Link><span>/</span><span>{data.connectionName}</span><GitFork size={13} /><strong>{data.database}</strong><span className="default-pill">Active</span></div></div><div className="page-actions"><Link className="button secondary" href="/sql"><TerminalSquare size={15} /> SQL Editor</Link><button className="button secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["database"] })}><RefreshCw size={14} /> Refresh</button></div></div>
    <div className="overview-columns"><div className="overview-primary">
      <section className="service-panel"><div className="service-head"><span>Service</span><span>Description / Details</span></div>
        <Link href="/databases" className="service-row"><span><i><Database size={18} /></i><strong>Postgres database</strong><em>Connected</em></span><span>{data.counts.schemas} schemas, {data.counts.tables} tables</span></Link>
        <Link href="/tables" className="service-row"><span><i><Table2 size={18} /></i><strong>Tables</strong></span><span>Browse and manage {data.counts.tables} tables <ArrowRight size={14} /></span></Link>
        <Link href="/sql" className="service-row"><span><i><TerminalSquare size={18} /></i><strong>SQL Editor</strong></span><span>Write and run SQL against {data.database} <ArrowRight size={14} /></span></Link>
        <Link href="/monitoring" className="service-row"><span><i><Activity size={18} /></i><strong>Monitoring</strong></span><span>{data.counts.activeConnections} active connections <ArrowRight size={14} /></span></Link>
        <Link href="/backups" className="service-row"><span><i><HardDrive size={18} /></i><strong>Backup & Restore</strong></span><span>PostgreSQL backup guidance <ArrowRight size={14} /></span></Link>
      </section>
      <section className="overview-chart"><div className="overview-chart-head"><h2>Largest tables</h2><Link href="/tables">View tables <ArrowRight size={14} /></Link></div>{chartData.length ? <div className="overview-chart-body"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 16, right: 14, left: 4, bottom: 0 }}><defs><linearGradient id="overviewSizeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00e599" stopOpacity={0.23} /><stop offset="100%" stopColor="#00e599" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="name" tick={{ fill: "#8b8b8b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#333333" }} /><Tooltip contentStyle={{ background: "#181818", border: "1px solid #3b3b3b", borderRadius: 4, color: "#e9e9e9" }} formatter={(value) => [`${Number(value).toFixed(1)} KB`, "Size"]} /><Area type="monotone" dataKey="size" stroke="#00e599" fill="url(#overviewSizeFill)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div> : <div className="overview-chart-empty"><Play size={17} /> No user tables yet. Create one in the SQL Editor.</div>}</section>
    </div><aside className="overview-aside">
      <section><h2>Connection <span>⌄</span></h2><Detail label="Name" value={data.connectionName} /><Detail label="Host" value={connection?.host ?? "—"} /><Detail label="Status" value={connection?.status === "online" ? "Connected" : "Offline"} accent /><Detail label="Database" value={data.database} accent /></section>
      <section><h2>Postgres <span>⌄</span></h2><Detail label="Role" value={data.user} /><Detail label="Version" value={data.version.split(" ")[1] ?? data.version} /><Detail label="Database size" value={formatBytes(data.sizeBytes)} /><Detail label="Schemas" value={String(data.counts.schemas)} accent /><Detail label="Views" value={String(data.counts.views)} accent /></section>
      <section><h2>Usage <span>⌄</span></h2><Detail label="Active connections" value={String(data.counts.activeConnections)} /><Detail label="Transactions" value={data.stats.transactions.toLocaleString()} /><Detail label="Cache hit" value={data.stats.cacheHitRatio === null ? "—" : `${data.stats.cacheHitRatio}%`} /><Detail label="Deadlocks" value={String(data.stats.deadlocks)} /><div className="aside-timestamp"><Clock3 size={13} /> Updated {new Date(data.sampledAt).toLocaleString()}</div></section>
    </aside></div>
  </div>;
}

function Detail({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="aside-detail"><span>{label}</span><strong className={accent ? "accent" : ""} title={value}>{value}</strong></div>; }
