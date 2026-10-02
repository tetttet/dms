"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Cable, Clock3, Database, ExternalLink, Gauge, Globe2, Plus, RefreshCw, Server } from "lucide-react";
import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/skeleton";
import { fetchJson } from "@/hooks/use-database";
import type { ConnectionStatus } from "@/lib/types";
import { useWorkspace } from "@/store/workspace";

export function ConnectionsPage() {
  const queryClient = useQueryClient();
  const setConnectionId = useWorkspace((state) => state.setConnectionId);
  const { data, isPending, error, isFetching } = useQuery<{ connections: ConnectionStatus[] }>({ queryKey: ["connections"], queryFn: () => fetchJson("/api/connections") });
  return <div className="page-stack">
    <PageHeader icon={Cable} eyebrow="Workspace" title="Connections" description="Configured PostgreSQL endpoints. Connection secrets never leave the server." actions={<button className="button secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["connections"] })}><RefreshCw className={isFetching ? "spin" : ""} size={14} /> Test all</button>} />
    {isPending ? <PageSkeleton /> : error ? <EmptyState icon={Server} title="Could not inspect connections" description={error.message} /> : !data?.connections.length ? <div className="setup-panel"><div className="setup-heading"><div className="setup-icon"><Plus size={20} /></div><div><h2>Add your first PostgreSQL database</h2><p>DMS discovers up to four server-side connection variables automatically.</p></div></div><pre><code>DATABASE_URL=postgresql://user:password@host:5432/database{"\n"}DATABASE_NAME=Production</code></pre><div className="callout"><Globe2 size={16} /><p>Connection URLs are read only on the server. Restart the development server after changing local environment variables.</p></div></div> : <div className="connection-grid">{data.connections.map((connection) => <article className="connection-card" key={connection.id}><div className="connection-card-top"><div className="db-icon"><Database size={19} /></div><StatusBadge tone={connection.status === "online" ? "success" : "danger"}><span className={`status-dot ${connection.status !== "online" ? "offline" : ""}`} /> {connection.status}</StatusBadge></div><h2>{connection.name}</h2><p>{connection.database}</p><div className="connection-detail-grid"><Detail icon={Globe2} label="Host" value={`${connection.host}:${connection.port}`} /><Detail icon={Gauge} label="Latency" value={connection.latencyMs ? `${connection.latencyMs} ms` : "Unavailable"} /><Detail icon={Server} label="Version" value={connection.version?.match(/PostgreSQL\s+([\d.]+)/)?.[1] ?? "Unavailable"} /><Detail icon={Clock3} label="Checked" value={new Date(connection.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} /></div>{connection.error && <div className="inline-error">{connection.error}</div>}<Link href="/" className="connection-link" onClick={() => setConnectionId(connection.id)}>Open workspace <ArrowRight size={14} /></Link></article>)}</div>}
    <div className="info-strip"><ExternalLink size={15} /><div><strong>Need another connection?</strong><span>Add DATABASE_URL_2 through DATABASE_URL_4 and optional matching DATABASE_NAME variables.</span></div></div>
  </div>;
}

function Detail({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: string }) { return <div className="connection-detail"><Icon size={14} /><div><span>{label}</span><strong title={value}>{value}</strong></div></div>; }

