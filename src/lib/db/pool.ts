import "server-only";
import { Pool, type PoolClient, types } from "pg";
import { getConnection } from "@/lib/db/config";

types.setTypeParser(20, (value) => Number(value));
types.setTypeParser(1700, (value) => Number(value));

const globalPools = globalThis as typeof globalThis & { __dmsPools?: Map<string, Pool> };
const pools = globalPools.__dmsPools ?? new Map<string, Pool>();
if (process.env.NODE_ENV !== "production") globalPools.__dmsPools = pools;

export function getPool(connectionId?: string) {
  const connection = getConnection(connectionId);
  const existing = pools.get(connection.id);
  if (existing) return existing;

  const pool = new Pool({
    connectionString: connection.connectionString,
    max: 8,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    allowExitOnIdle: true,
  });
  pool.on("error", (error) => console.error(`[DMS:${connection.id}] idle pool error`, error.message));
  pools.set(connection.id, pool);
  return pool;
}

export async function withClient<T>(connectionId: string | undefined, work: (client: PoolClient) => Promise<T>) {
  const client = await getPool(connectionId).connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
}

