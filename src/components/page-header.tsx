import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ icon: Icon, eyebrow, title, description, actions }: { icon?: LucideIcon; eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{Icon && <Icon size={13} />}{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

