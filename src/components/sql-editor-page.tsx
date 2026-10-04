"use client";

import dynamic from "next/dynamic";
import { loader } from "@monaco-editor/react";
import type { OnMount } from "@monaco-editor/react";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { format as formatSql } from "sql-formatter";
import {
  AlertTriangle, Check, ChevronRight, Clock3, Download, FileCode2,
  PanelLeftClose, Play, Plus, Save, Sparkles, Square, Trash2, X, XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useActiveConnection } from "@/hooks/use-database";
import { addHistory, readHistory } from "@/lib/history";
import { cn, formatDuration } from "@/lib/utils";
import type { QueryHistoryItem, QueryResult } from "@/lib/types";
import { usePreferences } from "@/store/workspace";

loader.config({ paths: { vs: "/monaco/vs" } });

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => <div className="editor-loading"><Sparkles size={18} /> Loading SQL workspace…</div> });

type EditorTab = { id: string; title: string; sql: string; saved: boolean };
type SavedQuery = { id: string; title: string; sql: string; updatedAt: string };

const welcomeSql = `-- Welcome to DMS\n-- Run the selection or the complete editor with Cmd/Ctrl + Enter.\n\nSELECT\n  current_database() AS database,\n  current_user AS role,\n  version() AS postgres_version;`;
const createTableSql = `CREATE TABLE public.example (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  name text NOT NULL,\n  created_at timestamptz NOT NULL DEFAULT now()\n);`;

function configureSqlMonaco(monaco: Parameters<OnMount>[1]) {
  if (!monaco.languages.getLanguages().some((language: { id: string }) => language.id === "sql")) monaco.languages.register({ id: "sql" });
  monaco.languages.setMonarchTokensProvider("sql", {
    ignoreCase: true,
    keywords: ["all", "alter", "and", "as", "asc", "begin", "between", "by", "case", "check", "column", "commit", "constraint", "create", "cross", "database", "default", "delete", "desc", "distinct", "drop", "else", "end", "exists", "false", "fetch", "for", "foreign", "from", "full", "group", "having", "if", "in", "index", "inner", "insert", "into", "is", "join", "key", "left", "limit", "not", "null", "offset", "on", "or", "order", "outer", "primary", "references", "returning", "right", "rollback", "schema", "select", "set", "table", "then", "true", "truncate", "union", "unique", "update", "using", "values", "view", "when", "where", "with"],
    tokenizer: {
      root: [
        [/--.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/'(?:''|[^'])*'/, "string"],
        [/"(?:""|[^"])*"/, "string"],
        [/\b\d+(?:\.\d+)?\b/, "number"],
        [/[a-zA-Z_][\w$]*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
        [/[=<>!~+*\/%|&^-]+/, "operator"],
      ],
      comment: [[/[^/*]+/, "comment"], [/\/\*/, "comment", "@push"], [/\*\//, "comment", "@pop"], [/[/*]/, "comment"]],
    },
  });
  monaco.editor.defineTheme("dms-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "55B8FF" },
      { token: "keyword.sql", foreground: "55B8FF" },
      { token: "string", foreground: "B7D47C" },
      { token: "string.sql", foreground: "B7D47C" },
      { token: "number", foreground: "C8A8FF" },
      { token: "number.sql", foreground: "C8A8FF" },
      { token: "comment", foreground: "777777", fontStyle: "italic" },
      { token: "comment.sql", foreground: "777777", fontStyle: "italic" },
      { token: "operator", foreground: "DDDDDD" },
      { token: "operator.sql", foreground: "DDDDDD" },
    ],
    colors: {
      "editor.background": "#000000",
      "editorGutter.background": "#000000",
      "editor.foreground": "#E8E8E8",
      "editorLineNumber.foreground": "#636363",
      "editorLineNumber.activeForeground": "#B7B7B7",
      "editor.lineHighlightBackground": "#141414",
      "editorCursor.foreground": "#00E599",
      "editor.selectionBackground": "#1A503C",
      "editor.inactiveSelectionBackground": "#19392E",
      "editorWidget.background": "#191919",
      "editorWidget.border": "#454545",
      "editorSuggestWidget.background": "#191919",
      "editorSuggestWidget.border": "#454545",
      "editorSuggestWidget.selectedBackground": "#303030",
      "editorIndentGuide.background1": "#242424",
    },
  });
  monaco.editor.setTheme("dms-dark");
}

export function SqlEditorPage() {
  const searchParams = useSearchParams();
  const { connection, connectionId } = useActiveConnection();
  const { editorFontSize, timeoutMs } = usePreferences();
  const [tabs, setTabs] = useState<EditorTab[]>([{ id: "initial-query", title: "Untitled query", sql: searchParams.get("template") === "create-table" ? createTableSql : welcomeSql, saved: false }]);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [recentHistory, setRecentHistory] = useState<QueryHistoryItem[]>([]);
  const [leftOpen, setLeftOpen] = useState(true);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [resultTab, setResultTab] = useState("results");
  const [editorHeight, setEditorHeight] = useState(52);
  const [pendingSql, setPendingSql] = useState<string | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  useEffect(() => {
    const updateHistory = () => setRecentHistory(readHistory());
    queueMicrotask(() => {
      try { setSavedQueries(JSON.parse(localStorage.getItem("dms-saved-queries") ?? "[]")); } catch { setSavedQueries([]); }
      updateHistory();
      const reopen = sessionStorage.getItem("dms-reopen-query");
      if (reopen) { setTabs([{ id: crypto.randomUUID(), title: "History query", sql: reopen, saved: false }]); sessionStorage.removeItem("dms-reopen-query"); }
    });
    window.addEventListener("dms-history-change", updateHistory);
    return () => window.removeEventListener("dms-history-change", updateHistory);
  }, []);

  const updateSql = useCallback((sql: string) => setTabs((items) => items.map((tab) => tab.id === activeId ? { ...tab, sql, saved: false } : tab)), [activeId]);
  const newTab = () => { const tab = { id: crypto.randomUUID(), title: `Query ${tabs.length + 1}`, sql: "", saved: false }; setTabs((items) => [...items, tab]); setActiveId(tab.id); };
  const closeTab = (id: string) => { if (tabs.length === 1) return updateSql(""); const index = tabs.findIndex((tab) => tab.id === id); const next = tabs.filter((tab) => tab.id !== id); setTabs(next); if (id === activeId) setActiveId(next[Math.max(index - 1, 0)].id); };
  const save = useCallback(() => {
    if (!active) return;
    const current = savedQueries.find((query) => query.id === active.id);
    const title = current?.title ?? prompt("Query name", active.title)?.trim();
    if (!title) return;
    const item = { id: active.id, title, sql: active.sql, updatedAt: new Date().toISOString() };
    const next = [item, ...savedQueries.filter((query) => query.id !== item.id)];
    setSavedQueries(next); localStorage.setItem("dms-saved-queries", JSON.stringify(next));
    setTabs((items) => items.map((tab) => tab.id === active.id ? { ...tab, title, saved: true } : tab));
    toast.success("Query saved in this browser");
  }, [active, savedQueries]);

  const run = useCallback(async (sqlOverride?: string, confirmed = false) => {
    if (!connectionId || !connection || !active) return toast.error("Configure a PostgreSQL connection first");
    const selection = editorRef.current?.getSelection();
    const selected = selection && !selection.isEmpty() ? editorRef.current?.getModel()?.getValueInRange(selection) : "";
    const sql = sqlOverride ?? (selected?.trim() ? selected : active.sql);
    if (!sql.trim()) return toast.warning("There is no SQL to execute");
    setRunning(true); setError(""); setResult(null); setResultTab("results");
    const controller = new AbortController(); abortRef.current = controller;
    const started = performance.now();
    try {
      const response = await fetch("/api/query", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ connectionId, sql, timeoutMs, confirmDestructive: confirmed }) });
      const body = await response.json();
      if (response.status === 409 && body.code === "DESTRUCTIVE_CONFIRMATION_REQUIRED") { setPendingSql(sql); return; }
      if (!response.ok) throw new Error(body.error ?? "Query execution failed");
      const value = body as QueryResult; setResult(value);
      addHistory({ id: value.id, connectionId, connectionName: connection.name, database: connection.database, sql, timestamp: value.executedAt, durationMs: value.durationMs, status: "success", rowCount: value.affectedRows });
      toast.success(`${value.command} completed in ${formatDuration(value.durationMs)}`);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") { setError("Request cancelled in DMS. The server-side statement timeout remains authoritative."); return; }
      const message = reason instanceof Error ? reason.message : "Query execution failed";
      setError(message); setResultTab("messages");
      addHistory({ id: crypto.randomUUID(), connectionId, connectionName: connection.name, database: connection.database, sql, timestamp: new Date().toISOString(), durationMs: performance.now() - started, status: "error", rowCount: null, error: message });
      toast.error("Query failed");
    } finally { setRunning(false); abortRef.current = null; }
  }, [active, connection, connectionId, timeoutMs]);

  useEffect(() => {
    function keys(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "Enter") { event.preventDefault(); void run(); }
      if (event.key.toLowerCase() === "s") { event.preventDefault(); save(); }
      if (event.shiftKey && event.key.toLowerCase() === "f") { event.preventDefault(); try { updateSql(formatSql(active.sql, { language: "postgresql" })); } catch { toast.error("Could not format SQL"); } }
    }
    window.addEventListener("keydown", keys); return () => window.removeEventListener("keydown", keys);
  }, [active, run, save, updateSql]);

  const startResize = (event: React.MouseEvent) => { const startY = event.clientY; const initial = editorHeight; function move(moveEvent: MouseEvent) { const delta = ((moveEvent.clientY - startY) / window.innerHeight) * 100; setEditorHeight(Math.max(25, Math.min(72, initial + delta))); } function up() { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); } window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); };
  const exportCsv = () => { if (!result) return; const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`; const csv = [result.columns.map((column) => escape(column.name)).join(","), ...result.rows.map((row) => result.columns.map((column) => escape(row[column.name])).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `dms-result-${Date.now()}.csv`; anchor.click(); URL.revokeObjectURL(url); };

  return <div className="sql-workspace">
    <div className={cn("query-sidebar", !leftOpen && "closed")}>
      <div className="query-sidebar-head"><div><strong>Queries</strong><span>{connection?.database ?? "No database"}</span></div><button onClick={() => setLeftOpen(false)}><PanelLeftClose size={15} /></button></div>
      <button className="new-query-button" onClick={newTab}><Plus size={15} /> New query</button>
      <div className="query-side-section"><p>Saved queries <span>{savedQueries.length}</span></p>{savedQueries.map((query) => <button key={query.id} onClick={() => { const tab = { id: query.id, title: query.title, sql: query.sql, saved: true }; setTabs((items) => items.some((item) => item.id === query.id) ? items : [...items, tab]); setActiveId(query.id); }}><FileCode2 size={14} /><span>{query.title}<small>{new Date(query.updatedAt).toLocaleDateString()}</small></span></button>)}{!savedQueries.length && <small className="side-empty">Saved queries stay in this browser.</small>}</div>
      <div className="query-side-section"><p>Recent <span>{recentHistory.length}</span></p>{recentHistory.slice(0, 5).map((item) => <button key={item.id} onClick={() => updateSql(item.sql)}><Clock3 size={14} /><span>{item.sql.replace(/\s+/g, " ").slice(0, 25)}<small>{formatDuration(item.durationMs)}</small></span></button>)}</div>
    </div>
    <div className="editor-main">
      <div className="editor-tabs">{!leftOpen && <button className="reopen-side" onClick={() => setLeftOpen(true)}><ChevronRight size={15} /></button>}{tabs.map((tab) => <button className={tab.id === activeId ? "active" : ""} key={tab.id} onClick={() => setActiveId(tab.id)}><FileCode2 size={13} /><span>{tab.title}{!tab.saved && " •"}</span><X size={12} onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }} /></button>)}<button className="add-tab" onClick={newTab}><Plus size={14} /></button></div>
      <div className="editor-toolbar"><div className="editor-context"><span className={cn("status-dot", connection?.status !== "online" && "offline")} /><strong>{connection?.name ?? "No connection"}</strong><ChevronRight size={12} /><span>{connection?.database ?? "Configure DATABASE_URL"}</span><ChevronRight size={12} /><span>public</span></div><div className="toolbar-actions"><button onClick={save}><Save size={14} /> Save</button><button onClick={() => { try { updateSql(formatSql(active.sql, { language: "postgresql" })); } catch { toast.error("Could not format SQL"); } }}><Sparkles size={14} /> Format</button>{running ? <button className="stop-button" onClick={() => abortRef.current?.abort()}><Square size={12} /> Cancel</button> : <button className="run-button" onClick={() => run()} disabled={!connectionId}><Play size={13} fill="currentColor" /> Run <kbd>⌘↵</kbd></button>}</div></div>
      <div className="editor-pane" style={{ height: `${editorHeight}%` }}><Editor height="100%" language="sql" value={active.sql} onChange={(value) => updateSql(value ?? "")} onMount={(editor, monaco) => { editorRef.current = editor; configureSqlMonaco(monaco); }} options={{ minimap: { enabled: false }, fontSize: editorFontSize, fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', lineHeight: 22, padding: { top: 17 }, automaticLayout: true, wordWrap: "on", scrollBeyondLastLine: false, bracketPairColorization: { enabled: true }, suggest: { showKeywords: true }, tabSize: 2 }} /></div>
      <div className="resize-handle" onMouseDown={startResize}><span /></div>
      <div className="results-pane" style={{ height: `${100 - editorHeight}%` }}><Tabs.Root value={resultTab} onValueChange={setResultTab}><div className="results-header"><Tabs.List><Tabs.Trigger value="results">Results {result && <span>{result.rowCount}</span>}</Tabs.Trigger><Tabs.Trigger value="messages">Messages {error && <span className="error-count">1</span>}</Tabs.Trigger><Tabs.Trigger value="details">Execution details</Tabs.Trigger></Tabs.List><div className="result-actions">{result && <><span><Check size={13} /> {formatDuration(result.durationMs)}</span><button onClick={exportCsv}><Download size={14} /> CSV</button><button onClick={() => { setResult(null); setError(""); }}><Trash2 size={14} /></button></>}</div></div><Tabs.Content value="results"><ResultsTable result={result} running={running} /></Tabs.Content><Tabs.Content value="messages"><div className="messages-panel">{error ? <div className="message-error"><XCircle size={16} /><pre>{error}</pre></div> : result?.notices.length ? result.notices.map((notice, index) => <div className="message-notice" key={index}>{notice}</div>) : <div className="result-empty">PostgreSQL notices and errors will appear here.</div>}</div></Tabs.Content><Tabs.Content value="details"><div className="execution-details">{result ? <><Detail label="Command" value={result.command} /><Detail label="Duration" value={formatDuration(result.durationMs)} /><Detail label="Rows returned" value={String(result.rowCount)} /><Detail label="Rows affected" value={String(result.affectedRows ?? "n/a")} /><Detail label="Executed" value={new Date(result.executedAt).toLocaleString()} /><Detail label="Result limit" value={result.truncated ? "Truncated at 1,000 rows" : "Complete"} /></> : <div className="result-empty">Execution metadata will appear after a query runs.</div>}</div></Tabs.Content></Tabs.Root></div>
    </div>
    <Dialog.Root open={Boolean(pendingSql)} onOpenChange={(open) => !open && setPendingSql(null)}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content"><div className="warning-icon"><AlertTriangle size={20} /></div><Dialog.Title>Confirm destructive query</Dialog.Title><Dialog.Description>This statement may permanently remove database objects or data. PostgreSQL permissions still apply, but this operation may not be recoverable.</Dialog.Description><pre><code>{pendingSql?.slice(0, 500)}</code></pre><div className="dialog-actions"><Dialog.Close className="button secondary">Cancel</Dialog.Close><button className="button danger" onClick={() => { const sql = pendingSql; setPendingSql(null); if (sql) void run(sql, true); }}>Run destructive query</button></div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}

function ResultsTable({ result, running }: { result: QueryResult | null; running: boolean }) {
  if (running) return <div className="result-empty"><span className="loader" /> Executing query…</div>;
  if (!result) return <div className="result-empty"><Play size={18} /> Run a query to see results.</div>;
  if (!result.columns.length) return <div className="result-empty"><Check size={18} /> {result.command} completed successfully. {result.affectedRows ?? 0} rows affected.</div>;
  return <div className="result-table-wrap"><table className="result-table"><thead><tr><th className="row-number">#</th>{result.columns.map((column) => <th key={column.name}><span>{column.name}</span><small>{column.dataTypeId}</small></th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index}><td className="row-number">{index + 1}</td>{result.columns.map((column) => <td key={column.name} onDoubleClick={() => navigator.clipboard.writeText(String(row[column.name] ?? ""))}>{formatValue(row[column.name])}</td>)}</tr>)}</tbody></table>{result.truncated && <div className="result-limit">Result limited to 1,000 rows to protect browser memory.</div>}</div>;
}
function formatValue(value: unknown) { if (value === null) return <span className="null-value">NULL</span>; if (typeof value === "boolean") return <span className={`boolean ${value}`}>{String(value)}</span>; if (typeof value === "object") return <code>{JSON.stringify(value)}</code>; return String(value); }
function Detail({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
