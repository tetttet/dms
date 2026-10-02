"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/store/workspace";
import type { ConnectionStatus } from "@/lib/types";

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

export function useActiveConnection() {
  const selected = useWorkspace((state) => state.connectionId);
  const query = useQuery<{ connections: ConnectionStatus[] }>({ queryKey: ["connections"], queryFn: () => fetchJson("/api/connections"), refetchInterval: 60_000 });
  const connection = query.data?.connections.find((item) => item.id === selected) ?? query.data?.connections[0];
  return { ...query, connection, connectionId: connection?.id };
}

export function useDatabaseResource<T>(resource: string, options?: { enabled?: boolean; refetchInterval?: number }) {
  const { connectionId, connection, ...connectionQuery } = useActiveConnection();
  const query = useQuery<T>({
    queryKey: ["database", connectionId, resource],
    queryFn: () => fetchJson(`/api/database?connectionId=${encodeURIComponent(connectionId!)}&resource=${encodeURIComponent(resource)}`),
    enabled: Boolean(connectionId) && options?.enabled !== false,
    refetchInterval: options?.refetchInterval,
  });
  return { ...query, connectionId, connection, connectionQuery };
}

