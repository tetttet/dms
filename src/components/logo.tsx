import { cn } from "@/lib/utils";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("logo", compact && "logo-compact")}>
      <svg className="logo-symbol" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M6 9c0-3 4.5-5.5 10-5.5S26 6 26 9v14c0 3-4.5 5.5-10 5.5S6 26 6 23V9Z" />
        <path d="M6 9c0 3 4.5 5.5 10 5.5S26 12 26 9M6 16c0 3 4.5 5.5 10 5.5S26 19 26 16" />
        <circle cx="16" cy="9" r="2" />
      </svg>
      {!compact && <div><strong>DMS</strong><span>Database Management System</span></div>}
    </div>
  );
}

