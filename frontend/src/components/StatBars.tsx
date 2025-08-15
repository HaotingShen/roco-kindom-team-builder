export function StatBars({ data }: { data?: Record<string, number> | null }) {
  if (!data || !Object.keys(data).length) return <div className="text-xs text-zinc-500">No stats.</div>;
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([,v]) => Number(v) || 0), 1);
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => {
        const pct = Math.round(((Number(v) || 0) / max) * 100);
        return (
          <div key={k}>
            <div className="flex items-center justify-between text-xs text-zinc-600">
              <span>{k}</span><span>{v}</span>
            </div>
            <div className="h-2 bg-zinc-100 rounded">
              <div className="h-2 rounded" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EnergyBars({ data }: { data?: Record<string, number> | null }) {
  // expects like { "cost0": 1, "cost1": 2, "cost2": 1 } etc. If unknown, show fallback.
  if (!data || !Object.keys(data).length) return <div className="text-xs text-zinc-500">No energy profile.</div>;
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([,v]) => Number(v) || 0), 1);
  return (
    <div className="space-y-2">
      {entries.map(([k, v]) => {
        const pct = Math.round(((Number(v) || 0) / max) * 100);
        return (
          <div key={k}>
            <div className="flex items-center justify-between text-xs text-zinc-600">
              <span>{k}</span><span>{v}</span>
            </div>
            <div className="h-2 bg-zinc-100 rounded">
              <div className="h-2 rounded" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}