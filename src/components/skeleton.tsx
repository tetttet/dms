export function PageSkeleton() {
  return <div className="skeleton-page"><div className="skeleton heading" /><div className="metric-grid">{Array.from({ length: 4 }).map((_, index) => <div className="skeleton card" key={index} />)}</div><div className="skeleton panel" /></div>;
}

