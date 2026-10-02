"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Activity, Boxes, Braces, ChevronDown, ChevronsLeft, CircleGauge, Clock3,
  Database, FileClock, GitFork, HardDrive, KeyRound, LayoutDashboard, ListTree,
  Menu, PanelLeftClose, PanelLeftOpen, PlugZap, RefreshCw, Search, Settings,
  ShieldCheck, Table2, TerminalSquare, Workflow, X, Zap, LogOut,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/lib/types";
import { useWorkspace } from "@/store/workspace";

const navigation = [
  { title: "Workspace", items: [
    { label: "Overview", href: "/", icon: LayoutDashboard },
    { label: "Connections", href: "/connections", icon: PlugZap },
    { label: "Monitoring", href: "/monitoring", icon: CircleGauge },
    { label: "Settings", href: "/settings", icon: Settings },
  ] },
  { title: "Postgres database", items: [
    { label: "Tables", href: "/tables", icon: Table2 },
    { label: "SQL Editor", href: "/sql", icon: TerminalSquare },
    { label: "Query History", href: "/history", icon: Clock3 },
    { label: "Backup & Restore", href: "/backups", icon: HardDrive },
    { label: "Databases", href: "/databases", icon: Database },
    { label: "Schemas", href: "/schemas", icon: Boxes },
    { label: "Views", href: "/views", icon: ListTree },
    { label: "Functions", href: "/functions", icon: Braces },
    { label: "Indexes", href: "/indexes", icon: Zap },
    { label: "Relationships", href: "/relationships", icon: GitFork },
    { label: "Extensions", href: "/extensions", icon: Workflow },
    { label: "Roles", href: "/roles", icon: KeyRound },
  ] },
  { title: "Operations", items: [
    { label: "Activity", href: "/activity", icon: Activity },
    { label: "Query Logs", href: "/query-logs", icon: FileClock },
  ] },
];

async function fetchConnections(): Promise<{ connections: ConnectionStatus[] }> {
  const response = await fetch("/api/connections");
  if (!response.ok) throw new Error("Could not load connections");
  return response.json();
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { connectionId, setConnectionId, sidebarCollapsed, toggleSidebar } = useWorkspace();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const collapsed = sidebarCollapsed && !mobileOpen;
  const { data, isFetching } = useQuery({ queryKey: ["connections"], queryFn: fetchConnections, refetchInterval: 60_000 });
  const connections = useMemo(() => data?.connections ?? [], [data]);
  const active = connections.find((item) => item.id === connectionId) ?? connections[0];

  useEffect(() => { useWorkspace.persist.rehydrate(); }, []);
  useEffect(() => { if (!connectionId && connections[0]) setConnectionId(connections[0].id); }, [connectionId, connections, setConnectionId]);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refresh = async () => {
    await queryClient.invalidateQueries();
    router.refresh();
  };

  const signOut = async () => {
    await fetch("/api/access", { method: "DELETE" });
    queryClient.clear();
    router.replace("/access");
    router.refresh();
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={18} /></button><Logo /></div>
        <button className="global-search" onClick={() => setSearchOpen(true)}><Search size={17} /><span>Search...</span><kbd>⌘K</kbd></button>
        <div className="topbar-actions"><span className="health-label"><span className={cn("status-dot", active?.status !== "online" && "offline")} />{active?.status === "online" ? "Connected" : "Not connected"}</span><button className="icon-button" onClick={refresh} title="Refresh workspace"><RefreshCw className={cn(isFetching && "spin")} size={16} /></button><Link className="icon-button" href="/settings" title="Settings"><Settings size={16} /></Link><button className="icon-button" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button></div>
      </header>
      <aside className={cn("sidebar", collapsed && "collapsed", mobileOpen && "mobile-open")}>
        <div className="sidebar-header">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="connection-trigger"><span className="connection-copy"><small>{active?.name ?? "DMS workspace"}</small><strong><GitFork size={14} /> {active?.database ?? "No database"}</strong></span><ChevronDown size={14} /></DropdownMenu.Trigger>
            <DropdownMenu.Portal><DropdownMenu.Content className="dropdown-content" align="start" sideOffset={6}><DropdownMenu.Label>PostgreSQL connections</DropdownMenu.Label>{connections.length ? connections.map((connection) => <DropdownMenu.Item className="dropdown-item" key={connection.id} onSelect={() => setConnectionId(connection.id)}><span className={cn("status-dot", connection.status !== "online" && "offline")} /><span><strong>{connection.name}</strong><small>{connection.database} · {connection.host}</small></span>{connection.id === active?.id && <ShieldCheck size={14} />}</DropdownMenu.Item>) : <div className="dropdown-empty">No connections configured</div>}<DropdownMenu.Separator /><DropdownMenu.Item className="dropdown-item" onSelect={() => router.push("/connections")}><PlugZap size={15} /> Manage connections</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal>
          </DropdownMenu.Root>
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={17} /></button>
        </div>
        {!collapsed && <Link className="sidebar-connect" href="/connections"><PlugZap size={16} /> Connect</Link>}
        <nav className="sidebar-nav">
          {navigation.map((group) => <div className="nav-group" key={group.title}>
            {!collapsed && group.title !== "Workspace" && <p>{group.title}</p>}
            {group.items.map((item) => {
              const selected = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return <Link title={collapsed ? item.label : undefined} key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={cn("nav-item", selected && "active")}><item.icon size={16} />{!collapsed && <span>{item.label}</span>}</Link>;
            })}
          </div>)}
        </nav>
        <div className="sidebar-footer"><button className="sidebar-collapse" onClick={toggleSidebar}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}{!collapsed && <span>Collapse menu</span>}</button></div>
      </aside>
      {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close sidebar" />}
      <div className="workspace">
        <main className="main-content">{children}</main>
      </div>
      {searchOpen && <CommandMenu close={() => setSearchOpen(false)} />}
    </div>
  );
}

function CommandMenu({ close }: { close: () => void }) {
  const [query, setQuery] = useState("");
  const items = navigation.flatMap((group) => group.items).filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  return <div className="command-overlay" onMouseDown={close}><div className="command-menu" onMouseDown={(event) => event.stopPropagation()}><div className="command-input"><Search size={17} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages and tools…" /><button onClick={close}><X size={15} /></button></div><div className="command-results">{items.map((item) => <Link key={item.href} href={item.href} onClick={close}><item.icon size={16} /><span>{item.label}</span><ChevronsLeft size={13} /></Link>)}</div></div></div>;
}
