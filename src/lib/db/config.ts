import "server-only";
import type { ConnectionSummary } from "@/lib/types";

export type ServerConnection = ConnectionSummary & { connectionString: string };

function parseConnection(index: number): ServerConnection | null {
  const suffix = index === 1 ? "" : `_${index}`;
  const connectionString = process.env[`DATABASE_URL${suffix}`];
  if (!connectionString) return null;

  try {
    const url = new URL(connectionString);
    const database = decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres";
    return {
      id: `connection-${index}`,
      name: process.env[`DATABASE_NAME${suffix}`] || database || `Connection ${index}`,
      database,
      host: url.hostname || "PostgreSQL",
      port: Number(url.port || 5432),
      ssl: url.searchParams.get("sslmode") !== "disable",
      configured: true,
      connectionString,
    };
  } catch {
    return {
      id: `connection-${index}`,
      name: process.env[`DATABASE_NAME${suffix}`] || `Connection ${index}`,
      database: "Unknown",
      host: "Invalid connection URL",
      port: 5432,
      ssl: false,
      configured: true,
      connectionString,
    };
  }
}

export function getConnections(): ServerConnection[] {
  return [1, 2, 3, 4].map(parseConnection).filter((item): item is ServerConnection => Boolean(item));
}

export function getPublicConnections(): ConnectionSummary[] {
  return getConnections().map((connection) => ({
    id: connection.id,
    name: connection.name,
    database: connection.database,
    host: connection.host,
    port: connection.port,
    ssl: connection.ssl,
    configured: connection.configured,
  }));
}

export function getConnection(id?: string) {
  const connections = getConnections();
  const connection = id ? connections.find((item) => item.id === id) : connections[0];
  if (!connection) throw new Error("No PostgreSQL connection is configured.");
  return connection;
}
