import { useI18n } from "@/i18n";

export function StatBars({ data }: { data?: Record<string, number> | null }) {
  const { t } = useI18n();
  if (!data || !Object.keys(data).length) return <div className="text-xs text-zinc-500">{t("stats.noStats")}</div>;
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
            <div className="h-2 rounded bar-bg">
              <div className="h-2 rounded bar-fg" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function EnergyBars({ data }: { data?: Record<string, number> | null }) {
  const { t } = useI18n();
  if (!data || !Object.keys(data).length) return <div className="text-xs text-zinc-500">{t("stats.noEnergy")}</div>;
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
            <div className="h-2 rounded bar-bg">
              <div className="h-2 rounded bar-fg" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}