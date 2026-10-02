import type { QueryHistoryItem } from "@/lib/types";

const HISTORY_KEY = "dms-query-history";

export function readHistory(): QueryHistoryItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}

export function addHistory(item: QueryHistoryItem) {
  const next = [item, ...readHistory()].slice(0, 500);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("dms-history-change"));
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
  window.dispatchEvent(new CustomEvent("dms-history-change"));
}

