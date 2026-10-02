import Link from "next/link";
import { CheckCircle2, DatabaseBackup, Download, FileSpreadsheet, ServerCog, ShieldAlert } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/page-header";

export function BackupsPage() {
  return <div className="page-stack"><PageHeader icon={DatabaseBackup} eyebrow="Operations" title="Backup & Restore" description="Understand which export and recovery capabilities are available through DMS." />
    <div className="capability-grid"><Capability icon={FileSpreadsheet} title="Query result export" status="Available" description="Run any SELECT statement and download its bounded result set as CSV." action="Open SQL Editor" href="/sql" /><Capability icon={Download} title="Table data export" status="Available" description="Open a table or query it in SQL, then export its data as CSV." action="Browse tables" href="/tables" /><Capability icon={ServerCog} title="Full logical backup" status="External tool required" description="A full pg_dump backup requires a trusted runtime with PostgreSQL client tools and durable object storage." /><Capability icon={DatabaseBackup} title="Provider backups" status="Provider API required" description="Neon and other managed-provider snapshots are separate from standard PostgreSQL credentials." /></div>
    <div className="panel backup-note"><ShieldAlert size={20} /><div><h3>No simulated backups</h3><p>DMS does not claim a CSV or SQL result is a complete, transaction-consistent database backup. Use <code>pg_dump</code>, your provider’s recovery system, or a dedicated backup service for production recovery.</p></div></div>
  </div>;
}
function Capability({ icon: Icon, title, status, description, action, href }: { icon: typeof DatabaseBackup; title: string; status: string; description: string; action?: string; href?: string }) { const available = status === "Available"; return <article className="capability-card"><div className="capability-top"><span><Icon size={18} /></span><StatusBadge tone={available ? "success" : "warning"}>{available && <CheckCircle2 size={12} />}{status}</StatusBadge></div><h2>{title}</h2><p>{description}</p>{action && href ? <Link className="text-link" href={href}>{action} →</Link> : <span className="requirement">Not enabled in this deployment</span>}</article>; }

