"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Copy, FileClock, RotateCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { clearHistory, readHistory } from "@/lib/history";
import { formatDuration } from "@/lib/utils";
import type { QueryHistoryItem } from "@/lib/types";

export function HistoryPage({ logs = false }: { logs?: boolean }) {
  const router = useRouter();
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "success" | "error">("all");
  useEffect(() => { const update = () => setHistory(readHistory()); update(); window.addEventListener("dms-history-change", update); return () => window.removeEventListener("dms-history-change", update); }, []);
  const rows = useMemo(() => history.filter((item) => (status === "all" || item.status === status) && `${item.sql} ${item.database} ${item.connectionName}`.toLowerCase().includes(search.toLowerCase())), [history, search, status]);
  const copy = async (sql: string) => { await navigator.clipboard.writeText(sql); toast.success("Query copied"); };
  const reopen = (item: QueryHistoryItem) => { sessionStorage.setItem("dms-reopen-query", item.sql); router.push("/sql"); };
  const removeAll = () => { if (confirm("Clear all application-recorded query history from this browser?")) { clearHistory(); setHistory([]); toast.success("Query history cleared"); } };
  return <div className="page-stack"><PageHeader icon={logs ? FileClock : Clock3} eyebrow="Workspace" title={logs ? "Query logs" : "Query history"} description={logs ? "SQL operations executed through DMS in this browser." : "Search, inspect, copy, and reopen your previous SQL executions."} actions={history.length ? <button className="button danger-ghost" onClick={removeAll}><Trash2 size={14} /> Clear history</button> : undefined} />
    <div className="panel data-panel"><div className="table-toolbar"><label className="search-field wide"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search SQL, connection, or database…" /></label><div className="segmented">{(["all", "success", "error"] as const).map((item) => <button className={status === item ? "active" : ""} key={item} onClick={() => setStatus(item)}>{item}</button>)}</div><span className="row-count">{rows.length} executions</span></div>
    {rows.length ? <div className="history-list">{rows.map((item) => <article className="history-row" key={item.id}><div className={`history-status ${item.status}`}>{item.status === "success" ? <Check size={14} /> : <X size={14} />}</div><div className="history-main"><code>{item.sql}</code><div className="history-meta"><span>{item.connectionName} / {item.database}</span><span>{new Date(item.timestamp).toLocaleString()}</span><span>{formatDuration(item.durationMs)}</span>{item.rowCount !== null && <span>{item.rowCount} rows</span>}</div>{item.error && <p className="history-error">{item.error}</p>}</div><div className="history-actions"><button onClick={() => copy(item.sql)} title="Copy SQL"><Copy size={14} /></button><button onClick={() => reopen(item)} title="Open in editor"><RotateCcw size={14} /></button></div></article>)}</div> : <EmptyState icon={Clock3} title="No query history" description={search || status !== "all" ? "No executions match the current filters." : "Queries run in DMS are recorded locally in this browser."} action="Open SQL Editor" href="/sql" />}</div>
    <div className="callout"><FileClock size={16} /><p>This is application-recorded history, not PostgreSQL server logs. It is stored in this browser and never includes connection credentials.</p></div>
  </div>;
}
