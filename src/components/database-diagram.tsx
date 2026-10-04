"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { ArrowUpRight, Focus, GitFork, KeyRound, LayoutGrid, Maximize2, Minimize2, Minus, Plus, Table2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { useDatabaseResource } from "@/hooks/use-database";
import type { DatabaseDiagram, DiagramRelationship, DiagramTable } from "@/lib/types";

const CARD_WIDTH = 268;
const HEADER_HEIGHT = 63;
const ROW_HEIGHT = 28;
const CARD_FOOTER = 12;
const GAP_X = 165;
const GAP_Y = 72;
const PAD = 100;

type Point = { x: number; y: number };
type View = { x: number; y: number; scale: number };
type Drag = { kind: "pan" | "node"; key?: string; x: number; y: number; origin: Point };

const keyOf = (schema: string, table: string) => `${schema}\u0000${table}`;
const heightOf = (table: DiagramTable) => HEADER_HEIGHT + Math.max(1, table.fields.length) * ROW_HEIGHT + CARD_FOOTER;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function initialPositions(tables: DiagramTable[], relationships: DiagramRelationship[]) {
  const positions: Record<string, Point> = {};
  const byKey = new Map(tables.map((table) => [keyOf(table.schema, table.name), table]));
  const neighbors = new Map([...byKey.keys()].map((key) => [key, new Set<string>()]));
  const parents = new Map([...byKey.keys()].map((key) => [key, new Set<string>()]));
  const children = new Map([...byKey.keys()].map((key) => [key, new Set<string>()]));
  for (const edge of relationships) {
    const child = keyOf(edge.schema, edge.table), parent = keyOf(edge.foreignSchema, edge.foreignTable);
    if (!byKey.has(child) || !byKey.has(parent) || child === parent) continue;
    neighbors.get(child)?.add(parent);
    neighbors.get(parent)?.add(child);
    parents.get(child)?.add(parent);
    children.get(parent)?.add(child);
  }

  const components: string[][] = [];
  const visited = new Set<string>();
  for (const key of byKey.keys()) {
    if (visited.has(key)) continue;
    const component: string[] = [];
    const pending = [key];
    visited.add(key);
    while (pending.length) {
      const current = pending.pop()!;
      component.push(current);
      for (const neighbor of neighbors.get(current) ?? []) {
        if (!visited.has(neighbor)) { visited.add(neighbor); pending.push(neighbor); }
      }
    }
    components.push(component);
  }
  components.sort((a, b) => b.length - a.length);

  let groupY = PAD;
  for (const component of components) {
    const group = new Set(component);
    const depth = new Map(component.map((key) => [key, 0]));
    const remaining = new Map(component.map((key) => [key, [...(parents.get(key) ?? [])].filter((parent) => group.has(parent)).length]));
    const pending = component.filter((key) => remaining.get(key) === 0);
    while (pending.length) {
      const parent = pending.shift()!;
      for (const child of children.get(parent) ?? []) {
        if (!group.has(child)) continue;
        depth.set(child, Math.max(depth.get(child) ?? 0, (depth.get(parent) ?? 0) + 1));
        remaining.set(child, (remaining.get(child) ?? 1) - 1);
        if (remaining.get(child) === 0) pending.push(child);
      }
    }
    const layers = new Map<number, string[]>();
    for (const key of component) {
      const level = depth.get(key) ?? 0;
      layers.set(level, [...(layers.get(level) ?? []), key]);
    }
    const rank = new Map<string, number>();
    let groupHeight = 0;
    for (const level of [...layers.keys()].sort((a, b) => a - b)) {
      const layer = layers.get(level)!;
      layer.sort((a, b) => {
        const score = (key: string) => {
          const earlier = [...(parents.get(key) ?? [])].filter((parent) => rank.has(parent));
          return earlier.length ? earlier.reduce((sum, parent) => sum + rank.get(parent)!, 0) / earlier.length : 100 - (children.get(key)?.size ?? 0);
        };
        return score(a) - score(b) || a.localeCompare(b);
      });
      let y = groupY;
      layer.forEach((key, index) => {
        positions[key] = { x: PAD + level * (CARD_WIDTH + GAP_X), y };
        rank.set(key, index);
        y += heightOf(byKey.get(key)!) + GAP_Y;
      });
      groupHeight = Math.max(groupHeight, y - groupY);
    }
    groupY += groupHeight + 100;
  }
  return positions;
}

function extent(tables: DiagramTable[], positions: Record<string, Point>) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const table of tables) {
    const point = positions[keyOf(table.schema, table.name)];
    if (!point) continue;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x + CARD_WIDTH);
    maxY = Math.max(maxY, point.y + heightOf(table));
  }
  return { minX, minY, maxX, maxY };
}

function edgePath(edge: DiagramRelationship, positions: Record<string, Point>, tables: Map<string, DiagramTable>) {
  const sourceKey = keyOf(edge.schema, edge.table);
  const targetKey = keyOf(edge.foreignSchema, edge.foreignTable);
  const source = positions[sourceKey], target = positions[targetKey];
  const sourceTable = tables.get(sourceKey), targetTable = tables.get(targetKey);
  if (!source || !target || !sourceTable || !targetTable) return null;
  const sourceRow = Math.max(0, sourceTable.fields.findIndex((field) => field.name === edge.column));
  const targetRow = Math.max(0, targetTable.fields.findIndex((field) => field.name === edge.foreignColumn));
  const sy = source.y + HEADER_HEIGHT + (sourceRow + .5) * ROW_HEIGHT;
  const ty = target.y + HEADER_HEIGHT + (targetRow + .5) * ROW_HEIGHT;
  const sourceRight = source.x < target.x || sourceKey === targetKey;
  const targetRight = target.x < source.x || sourceKey === targetKey;
  const sx = source.x + (sourceRight ? CARD_WIDTH : 0);
  const tx = target.x + (targetRight ? CARD_WIDTH : 0);
  if (sourceKey === targetKey || Math.abs(source.x - target.x) < CARD_WIDTH + 30) {
    const bend = Math.max(source.x + CARD_WIDTH, target.x + CARD_WIDTH) + 48;
    return `M ${sx} ${sy} H ${bend} V ${ty} H ${tx}`;
  }
  const curve = Math.max(55, Math.abs(tx - sx) * .45);
  return `M ${sx} ${sy} C ${sx + (sourceRight ? curve : -curve)} ${sy}, ${tx + (targetRight ? curve : -curve)} ${ty}, ${tx} ${ty}`;
}

export function DatabaseDiagram({ selected, onSelect }: { selected?: { schema: string; table: string }; onSelect?: (schema: string, table: string) => void }) {
  const { data, connectionId, isPending, error } = useDatabaseResource<DatabaseDiagram>("diagram");
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [movedPositions, setMovedPositions] = useState<Record<string, Point>>({});
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [fullscreen, setFullscreen] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const selectedKey = selected ? keyOf(selected.schema, selected.table) : null;

  const shown = useMemo(() => {
    if (!data) return { tables: [], relationships: [] };
    if (!selectedKey) return data;
    const keys = new Set([selectedKey]);
    for (const edge of data.relationships) {
      const from = keyOf(edge.schema, edge.table), to = keyOf(edge.foreignSchema, edge.foreignTable);
      if (from === selectedKey || to === selectedKey) { keys.add(from); keys.add(to); }
    }
    return { tables: data.tables.filter((table) => keys.has(keyOf(table.schema, table.name))), relationships: data.relationships.filter((edge) => keys.has(keyOf(edge.schema, edge.table)) && keys.has(keyOf(edge.foreignSchema, edge.foreignTable))) };
  }, [data, selectedKey]);
  const tableMap = useMemo(() => new Map(shown.tables.map((table) => [keyOf(table.schema, table.name), table])), [shown.tables]);
  const defaultPositions = useMemo(() => initialPositions(shown.tables, shown.relationships), [shown.tables, shown.relationships]);
  const positions = useMemo(() => ({ ...defaultPositions, ...movedPositions }), [defaultPositions, movedPositions]);
  const positionsRef = useRef(positions);
  const connectedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!hoveredKey) return keys;
    keys.add(hoveredKey);
    for (const edge of shown.relationships) {
      const child = keyOf(edge.schema, edge.table), parent = keyOf(edge.foreignSchema, edge.foreignTable);
      if (child === hoveredKey || parent === hoveredKey) { keys.add(child); keys.add(parent); }
    }
    return keys;
  }, [hoveredKey, shown.relationships]);

  const fit = useCallback((nextPositions: Record<string, Point>, tables: DiagramTable[]) => {
    const viewport = viewportRef.current;
    if (!viewport || !tables.length) return;
    const { minX, minY, maxX, maxY } = extent(tables, nextPositions);
    const scale = clamp(Math.min((viewport.clientWidth - 80) / (maxX - minX), (viewport.clientHeight - 80) / (maxY - minY)), .08, 1.25);
    setView({ x: (viewport.clientWidth - (minX + maxX) * scale) / 2, y: (viewport.clientHeight - (minY + maxY) * scale) / 2, scale });
  }, []);

  useEffect(() => { positionsRef.current = positions; }, [positions]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => { if (!dragRef.current && shown.tables.length) fit(positionsRef.current, shown.tables); });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fit, defaultPositions, shown.tables]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  const zoom = (factor: number, clientX?: number, clientY?: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const cy = (clientY ?? rect.top + rect.height / 2) - rect.top;
    setView((current) => {
      const scale = clamp(current.scale * factor, .08, 2.5);
      const ratio = scale / current.scale;
      return { x: cx - (cx - current.x) * ratio, y: cy - (cy - current.y) * ratio, scale };
    });
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoom(Math.exp(-event.deltaY * .001), event.clientX, event.clientY);
  };

  const beginPan = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget && !(event.target instanceof SVGElement)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "pan", x: event.clientX, y: event.clientY, origin: { x: view.x, y: view.y } };
  };

  const beginNode = (event: PointerEvent<HTMLDivElement>, key: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    viewportRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { kind: "node", key, x: event.clientX, y: event.clientY, origin: positions[key] };
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (drag.kind === "pan") setView((current) => ({ ...current, x: drag.origin.x + dx, y: drag.origin.y + dy }));
    else if (drag.key && drag.origin) setMovedPositions((current) => ({ ...current, [drag.key!]: { x: drag.origin.x + dx / view.scale, y: drag.origin.y + dy / view.scale } }));
  };

  if (!connectionId) return <EmptyState title="No database selected" description="Choose a PostgreSQL connection to view its diagram." />;
  if (isPending) return <div className="diagram-message">Loading database diagram…</div>;
  if (error) return <EmptyState title="Could not load diagram" description={error.message} />;
  if (!shown.tables.length) return <EmptyState title="No tables to show" description="The selected database has no accessible tables." />;

  return <div className={`diagram-shell${fullscreen ? " is-fullscreen" : ""}`}>
    <div className="diagram-toolbar"><div><GitFork size={16} /><strong>{selected ? `${selected.schema}.${selected.table}` : "Database diagram"}</strong><span>{shown.tables.length} tables · {shown.relationships.length} relationships</span></div><div className="diagram-controls"><button type="button" onClick={() => { setMovedPositions({}); fit(defaultPositions, shown.tables); }} title="Arrange tables" aria-label="Arrange tables"><LayoutGrid size={16} /></button><button type="button" onClick={() => zoom(1 / 1.2)} title="Zoom out" aria-label="Zoom out"><Minus size={16} /></button><span>{Math.round(view.scale * 100)}%</span><button type="button" onClick={() => zoom(1.2)} title="Zoom in" aria-label="Zoom in"><Plus size={16} /></button><button type="button" onClick={() => fit(positions, shown.tables)} title="Fit diagram" aria-label="Fit diagram"><Focus size={16} /></button><button type="button" className="diagram-fullscreen-button" onClick={() => setFullscreen((value) => !value)} title={fullscreen ? "Exit full screen" : "Open full screen"} aria-label={fullscreen ? "Exit full screen" : "Open full screen"}>{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{fullscreen ? "Exit full screen" : "Full screen"}</span></button></div></div>
    <div ref={viewportRef} className="diagram-viewport" onWheel={onWheel} onPointerDown={beginPan} onPointerMove={move} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
      <div className="diagram-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        <svg className="diagram-edges" aria-hidden="true"><defs><marker id="diagram-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 8 4 L 0 8 z" fill="#8d9590" /></marker></defs>{shown.relationships.map((edge, index) => { const path = edgePath(edge, positions, tableMap); const related = hoveredKey && (keyOf(edge.schema, edge.table) === hoveredKey || keyOf(edge.foreignSchema, edge.foreignTable) === hoveredKey); return path && <path className={hoveredKey ? related ? "active" : "muted" : undefined} key={`${edge.constraint}-${edge.column}-${index}`} d={path} markerEnd="url(#diagram-arrow)"><title>{`${edge.schema}.${edge.table}.${edge.column} → ${edge.foreignSchema}.${edge.foreignTable}.${edge.foreignColumn}`}</title></path>; })}</svg>
        {shown.tables.map((table) => { const key = keyOf(table.schema, table.name); const point = positions[key]; if (!point) return null; return <div key={key} className={`diagram-card${selectedKey === key ? " selected" : ""}${hoveredKey && !connectedKeys.has(key) ? " muted" : ""}`} style={{ left: point.x, top: point.y, width: CARD_WIDTH }} onMouseEnter={() => setHoveredKey(key)} onMouseLeave={() => setHoveredKey(null)} onPointerDown={(event) => event.stopPropagation()}>
          <div className="diagram-card-head" onPointerDown={(event) => beginNode(event, key)}><span className="diagram-card-icon"><Table2 size={16} /></span><span className="diagram-card-title"><small>{table.schema}</small><strong title={table.name}>{table.name}</strong></span>{onSelect && <button type="button" title={`Inspect ${table.name}`} aria-label={`Inspect ${table.schema}.${table.name}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onSelect(table.schema, table.name)}><ArrowUpRight size={16} /></button>}</div>
          <div className="diagram-card-fields">{table.fields.length ? table.fields.map((field) => <div className="diagram-card-field" key={field.name} title={`${field.name}: ${field.type}${field.nullable ? " · nullable" : " · not null"}`}><span className="diagram-field-name"><span className="diagram-field-key-slot">{field.primaryKey && <KeyRound size={12} />}</span><span className="diagram-field-label">{field.name}</span></span><span className="diagram-field-type">{field.type}</span></div>) : <div className="diagram-card-field empty">No columns</div>}</div>
        </div>; })}
      </div>
    </div>
    <div className="diagram-hint"><span><KeyRound size={12} /> Primary key</span><span><GitFork size={12} /> Foreign key → referenced column</span><span className="diagram-hint-help">Drag to move · Scroll to zoom · Esc exits full screen</span></div>
  </div>;
}
