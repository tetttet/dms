"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Boxes, Braces, ChevronDown, Database, GitFork, KeyRound, ListFilter, ListTree, RefreshCw, Search, Settings, Table2, TerminalSquare, Workflow, Zap } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { useDatabaseResource } from "@/hooks/use-database";
import type { TableSummary } from "@/lib/types";
import Link from "next/link";

const config = {
  databases: { title: "Databases", description: "Databases visible to the selected PostgreSQL role.", icon: Database },
  schemas: { title: "Schemas", description: "Namespaces and ownership in the current database.", icon: Boxes },
  views: { title: "Views", description: "Stored queries available to the current database role.", icon: ListTree },
  functions: { title: "Functions", description: "User-defined functions and their signatures.", icon: Braces },
  indexes: { title: "Indexes", description: "Index definitions across accessible schemas.", icon: Zap },
  relationships: { title: "Relationships", description: "Foreign-key paths between accessible tables.", icon: GitFork },
  extensions: { title: "Extensions", description: "PostgreSQL extensions installed in this database.", icon: Workflow },
  roles: { title: "Roles", description: "Visible roles and their non-sensitive capabilities.", icon: KeyRound },
  activity: { title: "Live activity", description: "Current sessions reported by pg_stat_activity.", icon: Activity },
} as const;

type Resource = keyof typeof config;
type ResourceResponse = { rows: Record<string, unknown>[]; columns?: string[]; sampledAt?: string };

export function ResourcePage({ resource }: { resource: Resource }) {
  const meta = config[resource];
  const queryClient = useQueryClient();
  const { data, isPending, error, connectionId, isFetching } = useDatabaseResource<ResourceResponse>(resource, { refetchInterval: resource === "activity" ? 15_000 : undefined });
  const [search, setSearch] = useState("");
  const rows = useMemo(() => (data?.rows ?? []).filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())), [data, search]);
  const columns = data?.columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  return <div className="page-stack"><PageHeader icon={meta.icon} eyebrow={resource === "activity" ? "Operations" : "Database object"} title={meta.title} description={meta.description} actions={<button className="button secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["database", connectionId, resource] })}><RefreshCw className={isFetching ? "spin" : ""} size={14} /> Refresh</button>} />
    {!connectionId ? <EmptyState title="No database selected" description="Configure a PostgreSQL connection to inspect this resource." action="Open connections" href="/connections" /> : isPending ? <PageSkeleton /> : error ? <EmptyState title={`Could not load ${meta.title.toLowerCase()}`} description={error.message} /> : <div className="panel data-panel"><div className="table-toolbar"><label className="search-field"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Filter ${meta.title.toLowerCase()}…`} /></label><span className="row-count">{rows.length} objects</span></div>{rows.length ? <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{humanize(column)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{columns.map((column) => <td key={column}>{formatCell(row[column])}</td>)}</tr>)}</tbody></table></div> : <EmptyState icon={ListFilter} title={`No ${meta.title.toLowerCase()} found`} description={search ? "No objects match this filter." : "PostgreSQL returned no accessible objects."} />}</div>}
    {resource === "activity" && <div className="callout"><Activity size={16} /><p>Visibility is limited by the connected PostgreSQL role. Other users’ query text may be hidden without <code>pg_read_all_stats</code>.</p></div>}
  </div>;
}

export function TablesPage() {
  const queryClient = useQueryClient();
  const { data, isPending, error, connectionId, connection, isFetching } = useDatabaseResource<{ rows: TableSummary[] }>("tables");
  const [search, setSearch] = useState("");
  const [schema, setSchema] = useState("public");
  const rows = (data?.rows ?? []).filter((table) => `${table.schema}.${table.name}`.toLowerCase().includes(search.toLowerCase()));
  const schemas = [...new Set((data?.rows ?? []).map((table) => table.schema))];
  const visibleSchema = schemas.includes(schema) || !schemas.length ? schema : schemas[0];
  const visibleRows = rows.filter((table) => table.schema === visibleSchema);
  return <div className="tables-workspace"><div className="tables-browser"><div className="tables-browser-head"><h1>Tables</h1><div className="breadcrumbs"><Link href="/">Overview</Link><span>/</span><span>{connection?.name ?? "Connection"}</span></div></div>
    <div className="tables-selector"><Database size={17} /><span>{connection?.database ?? "No database"}</span><ChevronDown size={15} /></div>
    <Link className="tables-schema-link" href="/schemas"><Boxes size={17} /> Schema</Link>
    <div className="tables-schema-controls"><label className="tables-selector"><Boxes size={17} /><select value={visibleSchema} onChange={(event) => setSchema(event.target.value)}>{(schemas.length ? schemas : ["public"]).map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label><div className="tables-search-row"><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." /></label><button className="button secondary square" title="Refresh tables" onClick={() => queryClient.invalidateQueries({ queryKey: ["database", connectionId, "tables"] })}><RefreshCw className={isFetching ? "spin" : ""} size={16} /></button><Link className="button secondary square" title="Create table" href="/sql?template=create-table">+</Link></div></div>
    <div className="tables-list">{!connectionId ? <div className="tables-list-empty">No database selected</div> : isPending ? <div className="tables-list-empty">Loading tables...</div> : error ? <div className="tables-list-empty">{error.message}</div> : visibleRows.length ? visibleRows.map((table) => <Link className="tables-list-item" href={`/tables/${encodeURIComponent(table.schema)}/${encodeURIComponent(table.name)}`} key={`${table.schema}.${table.name}`}><Table2 size={16} /><span>{table.name}</span><small>{table.estimatedRows.toLocaleString()}</small></Link>) : <div className="tables-list-empty">{search ? "No matching tables" : `0 tables in ${visibleSchema} schema`}</div>}</div>
    <div className="tables-browser-foot"><Link href="/settings" title="Settings"><Settings size={16} /></Link><Link href="/sql" title="SQL Editor"><TerminalSquare size={16} /></Link></div>
  </div><div className="tables-stage">{!connectionId ? <EmptyState title="No database selected" description="Configure a PostgreSQL connection to browse tables." action="Open connections" href="/connections" /> : <Link className="button secondary" href="/sql?template=create-table">Create table</Link>}</div></div>;
}

function humanize(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " "); }
function formatCell(value: unknown) {
  if (value === null || value === undefined) return <span className="null-value">NULL</span>;
  if (typeof value === "boolean") return <span className={`boolean ${value}`}>{String(value)}</span>;
  if (typeof value === "object") return <code>{JSON.stringify(value)}</code>;
  const text = String(value);
  return <span title={text}>{text.length > 140 ? `${text.slice(0, 140)}…` : text}</span>;
}
