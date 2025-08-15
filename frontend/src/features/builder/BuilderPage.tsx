import { useQuery, useMutation } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { useBuilderStore } from "./builderStore";
import MonsterCard from "@/components/MonsterCard";
import type { MonsterLiteOut, MagicItemOut, UserMonsterCreate, TeamCreate, TeamAnalysisOut } from "@/types";
import { useMemo, useState } from "react";
import MonsterInspector from "./MonsterInspector";

// helper: count boosted talents
function boostedCount(t: UserMonsterCreate["talent"]) {
  const vals = [t.hp_boost, t.phy_atk_boost, t.mag_atk_boost, t.phy_def_boost, t.mag_def_boost, t.spd_boost];
  return vals.filter(v => (v ?? 0) > 0).length;
}

function validateSlot(slot: UserMonsterCreate): string[] {
  const errs: string[] = [];
  if (!slot.monster_id) errs.push("Pick a monster");
  if (!slot.personality_id) errs.push("Set a personality");
  if (!slot.legacy_type_id) errs.push("Choose a legacy type");
  const moves = [slot.move1_id, slot.move2_id, slot.move3_id, slot.move4_id];
  if (moves.some(m => !m)) errs.push("Select 4 moves");
  const b = boostedCount(slot.talent || ({} as any));
  if (b === 0) errs.push("Pick at least 1 talent boost");
  if (b > 3) errs.push("At most 3 boosted stats");
  return errs;
}

function extractAxiosMessage(e: any): string {
  const d = e?.response?.data;
  if (d?.detail) return typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail);
  return e?.message ?? "Request failed";
}

export default function BuilderPage() {
  const { slots, setSlot, magic_item_id, setMagicItem, toPayload } = useBuilderStore();
  const [activeIdx, setActiveIdx] = useState<number>(0);

  const magicItems = useQuery({
    queryKey: ["magic_items"],
    queryFn: () => endpoints.magicItems().then(r => r.data)
  });

  const [serverErr, setServerErr] = useState<string | null>(null);

  const allErrors = useMemo<string[][]>(() => slots.map(validateSlot), [slots]);

  const canAnalyze = allErrors.every(list => list.length === 0);

  const analyze = useMutation({
    mutationFn: (payload: TeamCreate) =>
      endpoints.analyzeTeam(payload).then(r => r.data as TeamAnalysisOut),
    onError: (err) => setServerErr(extractAxiosMessage(err)),
    onSuccess: () => setServerErr(null)
  });

  const onAnalyze = () => {
    if (!canAnalyze) {
      setServerErr("Team is incomplete. Fill all 6 slots (monster, personality, legacy type, 4 moves, talents ≥1 boost).");
      return;
    }
    analyze.mutate(toPayload());
  };

  return (
    <div className="grid grid-cols-[1fr_320px] gap-4">
      <section className="space-y-3">
        {/* grid */}
        <div className="grid grid-cols-3 gap-3">
          {slots.map((slot, i) => {
            const errs = allErrors?.[i] ?? [];
            return (
              <div
                key={i}
                className={`rounded border ${i===activeIdx ? "border-zinc-900" : "border-zinc-200"} bg-white p-3 space-y-2 cursor-pointer`}
                onClick={() => setActiveIdx(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActiveIdx(i)}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-600">Slot {i+1}</div>
                  <button
                    className="text-xs underline"
                    onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
                  >
                    Edit
                  </button>
                </div>

                <MonsterCard
                  monsterId={slot.monster_id || undefined}
                  personalityId={slot.personality_id || null}
                  legacyTypeId={slot.legacy_type_id || null}
                  moveIds={[slot.move1_id, slot.move2_id, slot.move3_id, slot.move4_id]}
                  onClick={() => setActiveIdx(i)}
                />

                {errs.length > 0 && (
                  <ul className="text-[11px] text-red-600 list-disc pl-4">
                    {errs.map((e, j) => <li key={`${i}-${j}`}>{e}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {/* bottom bar */}
        <div className="flex items-center gap-3 bg-white border rounded p-3">
          <div className="text-sm">Magic Item:</div>
          <select
            value={magic_item_id ?? ""}
            onChange={e => setMagicItem(e.target.value ? Number(e.target.value) : null)}
            className="h-9 border rounded px-2"
          >
            <option value="">Select…</option>
            {(magicItems.data ?? []).map((mi: MagicItemOut) => (
              <option key={mi.id} value={mi.id}>{mi.name}</option>
            ))}
          </select>
          <div className="flex-1" />
          <button
            onClick={onAnalyze}
            disabled={!canAnalyze || analyze.isPending}
            className={`h-9 px-4 rounded ${canAnalyze ? "bg-zinc-900 text-white" : "bg-zinc-300 text-zinc-600 cursor-not-allowed"}`}
          >
            {analyze.isPending ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        {/* server errors or quick analysis */}
        {serverErr && (
          <div className="rounded border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
            {serverErr}
          </div>
        )}

        {analyze.data && (
          <div className="rounded border bg-white p-4">
            <div className="font-medium mb-2">Quick Analysis</div>
            <div className="text-sm text-zinc-700 whitespace-pre-wrap">
              {(analyze.data.recommendations ?? []).join("\n") || "No recommendations."}
            </div>
          </div>
        )}
      </section>

      {/* inspector unchanged */}
      <MonsterInspector activeIdx={activeIdx} />
    </div>
  );
}