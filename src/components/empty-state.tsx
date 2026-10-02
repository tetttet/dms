import { Cable, type LucideIcon } from "lucide-react";
import Link from "next/link";

export function EmptyState({
  icon: Icon = Cable,
  title,
  description,
  action,
  href,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: string;
  href?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={20} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && href && <Link className="button secondary" href={href}>{action}</Link>}
    </div>
  );
}

