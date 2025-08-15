import { useMutation } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { useBuilderStore } from "../builder/builderStore";
import type { TeamCreate, TeamAnalysisOut } from "@/types";
import { StatBars, EnergyBars } from "@/components/StatBars";

export default function AnalyzePage() {
  const toPayload = useBuilderStore(s => s.toPayload);
  const analyze = useMutation({
    mutationFn: (payload: TeamCreate) => endpoints.analyzeTeam(payload).then(r => r.data as TeamAnalysisOut)
  });

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <section className="lg:col-span-1 rounded border bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Per-Monster</h2>
          <button
            className="h-9 px-3 rounded bg-zinc-900 text-white"
            onClick={() => analyze.mutate(toPayload())}
          >
            Run Analysis
          </button>
        </div>
        <div className="space-y-2">
          {(analyze.data?.monsters ?? []).map(m => (
            <div key={m.monster_id} className="border rounded p-3 space-y-2">
              <div className="text-sm font-medium">Monster #{m.monster_id}</div>
              <StatBars data={m.effective_stats} />
              {"energy_profile" in m && m.energy_profile && typeof m.energy_profile === "object" ? (
                <EnergyBars data={m.energy_profile as any} />
              ) : (
                <div className="text-xs text-zinc-500">No energy data.</div>
              )}
              {/* counters & synergies */}
              <div className="text-xs text-zinc-600 mt-1">
                Counters: {m.counter_coverage ? JSON.stringify(m.counter_coverage) : "—"}
              </div>
              {m.trait_synergies?.length ? (
                <ul className="mt-2 list-disc pl-4 text-sm">
                  {m.trait_synergies.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-medium mb-2">Team Coverage & Weakness</h2>
        <div className="text-sm">
          Weak to: {(analyze.data?.team_weak_to ?? []).join(", ") || "—"}
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-medium mb-2">Magic Item & Recommendations</h2>
        <div className="text-sm mb-2">Valid targets: {(analyze.data?.valid_targets ?? []).join(", ") || "—"}</div>
        <ul className="list-disc pl-4 space-y-1 text-sm">
          {(analyze.data?.recommendations ?? []).map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </section>
    </div>
  );
}