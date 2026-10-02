import "server-only";
import { randomUUID } from "node:crypto";
import type { FieldDef, PoolClient } from "pg";
import { getConnection, getConnections, getPublicConnections } from "@/lib/db/config";
import { getPool, withClient } from "@/lib/db/pool";
import type { ConnectionStatus, OverviewData, QueryResult, TableSummary } from "@/lib/types";
import { safeJsonValue } from "@/lib/utils";

export function quoteIdentifier(value: string) {
  if (!value || value.includes("\0")) throw new Error("Invalid database identifier.");
  return `"${value.replaceAll('"', '""')}"`;
}

export function isDestructiveSql(sql: string) {
  const normalized = sql.replace(/--.*$/gm, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim();
  return /\b(DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE|DELETE\s+FROM\s+[^;]+\s*(;|$)|ALTER\s+TABLE\s+[^;]+\s+DROP)\b/i.test(normalized);
}

export async function listConnectionStatuses(): Promise<ConnectionStatus[]> {
  return Promise.all(getPublicConnections().map(async (connection) => {
    const started = performance.now();
    try {
      const result = await getPool(connection.id).query<{ version: string; user: string }>(
        "select version(), current_user as user",
      );
      return {
        ...connection,
        status: "online" as const,
        latencyMs: Math.round(performance.now() - started),
        version: result.rows[0]?.version,
        user: result.rows[0]?.user,
        checkedAt: new Date().toISOString(),
      };
    } catch (reason) {
      return {
        ...connection,
        status: "offline" as const,
        error: reason instanceof Error ? reason.message : "Connection failed",
        checkedAt: new Date().toISOString(),
      };
    }
  }));
}

export async function discoverDatabases(connectionId: string) {
  const result = await getPool(connectionId).query<{
    name: string; owner: string; size: number; allow_connections: boolean; is_current: boolean;
  }>(`select d.datname as name, pg_get_userbyid(d.datdba) as owner,
      pg_database_size(d.datname)::float8 as size, d.datallowconn as allow_connections,
      d.datname = current_database() as is_current
    from pg_database d where not d.datistemplate order by d.datname`);
  return result.rows;
}

export async function getOverview(connectionId: string): Promise<OverviewData> {
  const connection = getConnection(connectionId);
  const [info, counts, stats, largest, connections] = await Promise.all([
    getPool(connectionId).query<{ database: string; user: string; version: string; size: number; uptime_seconds: number | null }>(`
      select current_database() as database, current_user as user,
        current_setting('server_version') as version,
        pg_database_size(current_database())::float8 as size,
        extract(epoch from (now() - pg_postmaster_start_time()))::float8 as uptime_seconds`),
    getPool(connectionId).query<{ tables: number; schemas: number; views: number; indexes: number; active_connections: number }>(`
      select
        (select count(*)::int from information_schema.tables where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog','information_schema')) as tables,
        (select count(*)::int from information_schema.schemata where schema_name not like 'pg_%' and schema_name <> 'information_schema') as schemas,
        (select count(*)::int from information_schema.views where table_schema not in ('pg_catalog','information_schema')) as views,
        (select count(*)::int from pg_indexes where schemaname not in ('pg_catalog','information_schema')) as indexes,
        (select count(*)::int from pg_stat_activity where datname = current_database()) as active_connections`),
    getPool(connectionId).query<{ cache_hit_ratio: number | null; transactions: number; sequential_scans: number; index_scans: number; tuples_returned: number; deadlocks: number }>(`
      select case when blks_hit + blks_read = 0 then null else round((blks_hit::numeric / (blks_hit + blks_read)) * 100, 2)::float8 end as cache_hit_ratio,
        (xact_commit + xact_rollback)::float8 as transactions, tup_returned::float8 as tuples_returned, deadlocks::float8 as deadlocks,
        coalesce((select sum(seq_scan)::float8 from pg_stat_user_tables), 0) as sequential_scans,
        coalesce((select sum(idx_scan)::float8 from pg_stat_user_tables), 0) as index_scans
      from pg_stat_database where datname = current_database()`),
    getPool(connectionId).query<{ name: string; schema: string; size: number; formattedSize: string; rows: number }>(`
      select c.relname as name, n.nspname as schema, pg_total_relation_size(c.oid)::float8 as size,
        pg_size_pretty(pg_total_relation_size(c.oid)) as "formattedSize", greatest(c.reltuples, 0)::float8 as rows
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname not in ('pg_catalog','information_schema')
      order by pg_total_relation_size(c.oid) desc limit 6`),
    getPool(connectionId).query<{ state: string; count: number }>(`
      select coalesce(state, 'unknown') as state, count(*)::int as count
      from pg_stat_activity where datname = current_database() group by state order by count desc`),
  ]);
  const first = info.rows[0];
  const count = counts.rows[0];
  const stat = stats.rows[0] ?? { cache_hit_ratio: null, transactions: 0, sequential_scans: 0, index_scans: 0, tuples_returned: 0, deadlocks: 0 };
  return {
    database: first.database,
    connectionName: connection.name,
    user: first.user,
    version: first.version,
    size: "",
    sizeBytes: first.size,
    uptimeSeconds: first.uptime_seconds,
    counts: { tables: count.tables, schemas: count.schemas, views: count.views, indexes: count.indexes, activeConnections: count.active_connections },
    stats: { cacheHitRatio: stat.cache_hit_ratio, transactions: stat.transactions, sequentialScans: stat.sequential_scans, indexScans: stat.index_scans, tuplesReturned: stat.tuples_returned, deadlocks: stat.deadlocks },
    largestTables: largest.rows.map((row) => ({ ...row })),
    connections: connections.rows,
    sampledAt: new Date().toISOString(),
  };
}

export async function listTables(connectionId: string): Promise<TableSummary[]> {
  const result = await getPool(connectionId).query<TableSummary>(`
    select n.nspname as schema, c.relname as name, greatest(c.reltuples, 0)::float8 as "estimatedRows",
      pg_size_pretty(pg_total_relation_size(c.oid)) as size, pg_total_relation_size(c.oid)::float8 as "sizeBytes",
      (select count(*)::int from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns,
      coalesce((select array_agg(a.attname order by x.ordinality)
        from pg_index i cross join lateral unnest(i.indkey) with ordinality x(attnum, ordinality)
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = x.attnum
        where i.indrelid = c.oid and i.indisprimary), '{}') as "primaryKey"
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema')
    order by n.nspname, c.relname`);
  return result.rows;
}

export async function getTableDetails(connectionId: string, schema: string, table: string) {
  const regclass = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const [columns, indexes, constraints, data] = await Promise.all([
    getPool(connectionId).query(`select a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
      not a.attnotnull as nullable, pg_get_expr(d.adbin, d.adrelid) as default,
      a.attidentity as identity, col_description(a.attrelid, a.attnum) as comment,
      exists(select 1 from pg_index i where i.indrelid=a.attrelid and i.indisprimary and a.attnum=any(i.indkey)) as "primaryKey"
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=$1::regclass and a.attnum>0 and not a.attisdropped order by a.attnum`, [regclass]),
    getPool(connectionId).query(`select indexname as name, indexdef as definition from pg_indexes where schemaname=$1 and tablename=$2 order by indexname`, [schema, table]),
    getPool(connectionId).query(`select conname as name, contype as type, pg_get_constraintdef(oid, true) as definition
      from pg_constraint where conrelid=$1::regclass order by conname`, [regclass]),
    getPool(connectionId).query(`select * from ${regclass} limit 100`),
  ]);
  return {
    schema, table,
    columns: columns.rows,
    indexes: indexes.rows,
    constraints: constraints.rows,
    data: data.rows.map((row) => safeJsonValue(row)),
    dataColumns: data.fields.map((field) => field.name),
    truncated: data.rowCount === 100,
  };
}

export async function getResource(connectionId: string, resource: string) {
  const queries: Record<string, { sql: string; params?: unknown[] }> = {
    schemas: { sql: `select schema_name as name, schema_owner as owner from information_schema.schemata where schema_name not like 'pg_%' and schema_name <> 'information_schema' order by schema_name` },
    views: { sql: `select schemaname as schema, viewname as name, viewowner as owner, definition from pg_views where schemaname not in ('pg_catalog','information_schema') order by schemaname, viewname` },
    functions: { sql: `select n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as arguments, pg_get_function_result(p.oid) as "returnType", l.lanname as language from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname not in ('pg_catalog','information_schema') order by n.nspname,p.proname` },
    indexes: { sql: `select schemaname as schema, tablename as table, indexname as name, indexdef as definition from pg_indexes where schemaname not in ('pg_catalog','information_schema') order by schemaname,tablename,indexname` },
    extensions: { sql: `select e.extname as name, e.extversion as version, n.nspname as schema, c.comment from pg_extension e join pg_namespace n on n.oid=e.extnamespace left join pg_available_extensions c on c.name=e.extname order by e.extname` },
    roles: { sql: `select rolname as name, rolcanlogin as login, rolsuper as superuser, rolcreatedb as "createDatabase", rolcreaterole as "createRole", rolinherit as inherit, rolconnlimit as "connectionLimit" from pg_roles order by rolname` },
    activity: { sql: `select pid, datname as database, usename as user, application_name as application, state, wait_event_type as "waitType", wait_event as "waitEvent", query_start as "queryStart", extract(epoch from (now()-query_start))::float8 as "durationSeconds", left(query,500) as query from pg_stat_activity where datname=current_database() order by query_start nulls last` },
    relationships: { sql: `select ns.nspname as schema, cl.relname as table, a.attname as column, fns.nspname as "foreignSchema", fcl.relname as "foreignTable", fa.attname as "foreignColumn", con.conname as constraint from pg_constraint con join pg_class cl on cl.oid=con.conrelid join pg_namespace ns on ns.oid=cl.relnamespace join pg_class fcl on fcl.oid=con.confrelid join pg_namespace fns on fns.oid=fcl.relnamespace join lateral unnest(con.conkey,con.confkey) k(attnum,fattnum) on true join pg_attribute a on a.attrelid=cl.oid and a.attnum=k.attnum join pg_attribute fa on fa.attrelid=fcl.oid and fa.attnum=k.fattnum where con.contype='f' order by ns.nspname,cl.relname` },
  };
  const query = queries[resource];
  if (!query) throw new Error("Unsupported database resource.");
  const result = await getPool(connectionId).query(query.sql, query.params);
  return { rows: result.rows.map((row) => safeJsonValue(row)), columns: result.fields.map((field) => field.name), sampledAt: new Date().toISOString() };
}

export async function executeSql(connectionId: string, sql: string, timeoutMs: number): Promise<QueryResult> {
  const started = performance.now();
  return withClient(connectionId, async (client: PoolClient) => {
    const notices: string[] = [];
    const onNotice = (notice: { message?: string }) => { if (notice.message) notices.push(notice.message); };
    client.on("notice", onNotice);
    try {
      await client.query(`set statement_timeout = ${Math.max(1_000, Math.min(timeoutMs, 120_000))}`);
      const result = await client.query({ text: sql, rowMode: "array" });
      const last = Array.isArray(result) ? result.at(-1) : result;
      if (!last) throw new Error("PostgreSQL returned no result.");
      const fields = last.fields as FieldDef[];
      const rows = (last.rows as unknown[][]).slice(0, 1000).map((row) => Object.fromEntries(fields.map((field: FieldDef, index: number) => [field.name, safeJsonValue(row[index])])));
      return {
        id: randomUUID(),
        columns: fields.map((field: FieldDef) => ({ name: field.name, dataTypeId: field.dataTypeID })),
        rows,
        rowCount: rows.length,
        affectedRows: last.rowCount,
        command: last.command,
        durationMs: performance.now() - started,
        truncated: (last.rowCount ?? 0) > rows.length,
        executedAt: new Date().toISOString(),
        notices,
      };
    } finally {
      client.off("notice", onNotice);
      await client.query("reset statement_timeout").catch(() => undefined);
    }
  });
}

export function hasConfiguredConnections() {
  return getConnections().length > 0;
}
