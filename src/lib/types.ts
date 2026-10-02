export type ConnectionSummary = {
  id: string;
  name: string;
  database: string;
  host: string;
  port: number;
  ssl: boolean;
  configured: boolean;
};

export type ConnectionStatus = ConnectionSummary & {
  status: "online" | "offline";
  latencyMs?: number;
  version?: string;
  user?: string;
  error?: string;
  checkedAt: string;
};

export type QueryResult = {
  id: string;
  columns: { name: string; dataTypeId: number }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  affectedRows: number | null;
  command: string;
  durationMs: number;
  truncated: boolean;
  executedAt: string;
  notices: string[];
};

export type QueryHistoryItem = {
  id: string;
  connectionId: string;
  connectionName: string;
  database: string;
  sql: string;
  timestamp: string;
  durationMs: number;
  status: "success" | "error";
  rowCount: number | null;
  error?: string;
};

export type TableSummary = {
  schema: string;
  name: string;
  estimatedRows: number;
  size: string;
  sizeBytes: number;
  columns: number;
  primaryKey: string[];
};

export type OverviewData = {
  database: string;
  connectionName: string;
  user: string;
  version: string;
  size: string;
  sizeBytes: number;
  uptimeSeconds: number | null;
  counts: { tables: number; schemas: number; views: number; indexes: number; activeConnections: number };
  stats: {
    cacheHitRatio: number | null;
    transactions: number;
    sequentialScans: number;
    indexScans: number;
    tuplesReturned: number;
    deadlocks: number;
  };
  largestTables: { name: string; schema: string; size: number; formattedSize: string; rows: number }[];
  connections: { state: string; count: number }[];
  sampledAt: string;
};

