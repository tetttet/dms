"use client";

import { useQuery } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowLeft, Copy, Database, KeyRound, RefreshCw, Table2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { fetchJson, useActiveConnection } from "@/hooks/use-database";

type TableDetails = {
  schema: string; table: string; columns: Record<string, unknown>[]; indexes: Record<string, unknown>[];
  constraints: Record<string, unknown>[]; data: Record<string, unknown>[]; dataColumns: string[]; truncated: boolean;
};

export function TableDetailPage({ schema, table }: { schema: string; table: string }) {
  const { connectionId } = useActiveConnection();
  const url = `/api/database?connectionId=${encodeURIComponent(connectionId ?? "")}&resource=table&schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(table)}`;
  const { data, isPending, error, refetch, isFetching } = useQuery<TableDetails>({ queryKey: ["table-detail", connectionId, schema, table], queryFn: () => fetchJson(url), enabled: Boolean(connectionId) });
  const definition = data ? buildDefinition(data) : "";
  return <div className="page-stack"><Link href="/tables" className="back-link"><ArrowLeft size={14} /> All tables</Link><PageHeader icon={Table2} eyebrow={schema} title={table} description="Inspect records, columns, indexes, constraints, and generated SQL." actions={<button className="button secondary" onClick={() => refetch()}><RefreshCw className={isFetching ? "spin" : ""} size={14} /> Refresh</button>} />
    {!connectionId ? <EmptyState title="No database selected" description="Choose a PostgreSQL connection first." /> : isPending ? <PageSkeleton /> : error || !data ? <EmptyState title="Could not inspect table" description={error?.message ?? "The table is unavailable."} /> : <Tabs.Root className="detail-tabs" defaultValue="data"><Tabs.List className="tabs-list">{["data", "structure", "indexes", "constraints", "relationships", "sql"].map((tab) => <Tabs.Trigger value={tab} key={tab}>{tab}</Tabs.Trigger>)}</Tabs.List><Tabs.Content value="data"><DataTable rows={data.data} columns={data.dataColumns} />{data.truncated && <div className="table-note">Showing the first 100 rows. Use the SQL Editor for filtered or larger result sets.</div>}</Tabs.Content><Tabs.Content value="structure"><MetadataTable rows={data.columns} /></Tabs.Content><Tabs.Content value="indexes"><MetadataTable rows={data.indexes} /></Tabs.Content><Tabs.Content value="constraints"><MetadataTable rows={data.constraints} /></Tabs.Content><Tabs.Content value="relationships"><MetadataTable rows={data.constraints.filter((row) => row.type === "f")} empty="This table has no outgoing foreign-key relationships." /></Tabs.Content><Tabs.Content value="sql"><div className="code-panel"><button onClick={async () => { await navigator.clipboard.writeText(definition); toast.success("Definition copied"); }}><Copy size={14} /> Copy SQL</button><pre><code>{definition}</code></pre></div></Tabs.Content></Tabs.Root>}
  </div>;
}

function DataTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: string[] }) { return <div className="panel data-panel"><div className="table-toolbar"><span className="row-count">{rows.length} rows</span><span className="table-safety"><KeyRound size={13} /> Read-only preview</span></div>{rows.length ? <div className="table-scroll"><table><thead><tr><th>#</th>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td className="row-number">{index + 1}</td>{columns.map((column) => <td key={column}>{cell(row[column])}</td>)}</tr>)}</tbody></table></div> : <EmptyState icon={Database} title="This table is empty" description="Insert records through the SQL Editor." />}</div>; }
function MetadataTable({ rows, empty = "No metadata returned." }: { rows: Record<string, unknown>[]; empty?: string }) { const columns = rows[0] ? Object.keys(rows[0]) : []; return <div className="panel data-panel">{rows.length ? <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{cell(row[column])}</td>)}</tr>)}</tbody></table></div> : <EmptyState title="Nothing to show" description={empty} />}</div>; }
function cell(value: unknown) { if (value == null) return <span className="null-value">NULL</span>; if (typeof value === "boolean") return <span className={`boolean ${value}`}>{String(value)}</span>; return typeof value === "object" ? <code>{JSON.stringify(value)}</code> : String(value); }
function buildDefinition(data: TableDetails) { const quote = (value: string) => `"${value.replaceAll('"', '""')}"`; const columns = data.columns.map((column) => `  ${quote(String(column.name))} ${column.type}${column.identity ? " GENERATED BY DEFAULT AS IDENTITY" : ""}${column.default ? ` DEFAULT ${column.default}` : ""}${column.nullable ? "" : " NOT NULL"}`); const constraints = data.constraints.map((constraint) => `  CONSTRAINT ${quote(String(constraint.name))} ${constraint.definition}`); return `CREATE TABLE ${quote(data.schema)}.${quote(data.table)} (\n${[...columns, ...constraints].join(",\n")}\n);`; }

