import { useQuery, useQueries } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { useI18n, pickName } from "@/i18n";
import MonsterPicker from "./MonsterPicker";
import { useBuilderStore } from "./builderStore";
import type { ID, MoveOut, PersonalityOut, TypeOut, UserMonsterCreate } from "@/types";
import { useMemo, useEffect, useRef, useState } from "react";
import CustomSelect from "@/components/CustomSelect";

// ---------- helpers ----------
function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="text-[11px] px-2 py-1 rounded border border-amber-300 bg-amber-50 text-amber-800"
    >
      {children}
    </div>
  );
}

function useMonsterDetail(monsterId: ID | 0) {
  return useQuery({
    queryKey: ["monster", monsterId],
    queryFn: () => endpoints.monsterById(monsterId!).then((r) => r.data),
    enabled: !!monsterId,
  });
}

// --- Personality effect formatters ---
const EFFECT_FIELDS = [
  ["labels.hp", "hp_mod_pct"],
  ["labels.phyAtk", "phy_atk_mod_pct"],
  ["labels.magAtk", "mag_atk_mod_pct"],
  ["labels.phyDef", "phy_def_mod_pct"],
  ["labels.magDef", "mag_def_mod_pct"],
  ["labels.spd", "spd_mod_pct"],
] as const;

function getEffects(p: PersonalityOut, t: (k: string) => string) {
  return EFFECT_FIELDS.map(
    ([labelKey, key]) => [t(labelKey), (p as any)[key] as number] as const
  );
}

// Row text on the right, e.g. [Mag Atk ↑, Phy Def ↓]
function formatRowEffects(p: PersonalityOut, t: (k: string) => string) {
  const ups = getEffects(p, t).filter(([, v]) => v > 0).map(([n]) => `${n} ↑`);
  const downs = getEffects(p, t).filter(([, v]) => v < 0).map(([n]) => `${n} ↓`);
  const items = [...ups, ...downs];
  return items.length ? `[${items.join(", ")}]` : "";
}

// +20% when value is 0.2, -10% when value is -0.1 (also works if server sends 20 / -10)
function pct(v: number) {
  const raw = Math.abs(v) <= 1 ? v * 100 : v;
  const rounded = Math.round(Math.abs(raw) * 10) / 10;
  return `${v > 0 ? "+" : "-"}${rounded}%`;
}

// Sentence under the control, e.g. "Mag Atk +20%, Phy Def -10%"
function formatSentenceEffects(p: PersonalityOut, t: (k: string) => string) {
  const items = getEffects(p, t).filter(([, v]) => v !== 0);
  if (!items.length) return "";
  // positives first, then negatives (just a nicety)
  const ordered = [
    ...items.filter(([, v]) => v > 0),
    ...items.filter(([, v]) => v < 0),
  ];
  return ordered.map(([n, v]) => `${n} ${pct(v)}`).join(", ");
}

// Build maps using raw IDs (no network fetch needed)
function extractLegacyInfo(detail: any): {
  byType: Map<number, number>; // type_id -> move_id
  idSet: Set<number>; // all legacy move ids
} {
  const byType = new Map<number, number>();
  const idSet = new Set<number>();
  if (!detail) return { byType, idSet };

  if (detail.legacy_moves_by_type) {
    for (const [k, v] of Object.entries(detail.legacy_moves_by_type)) {
      const typeId = Number(k);
      const moveId =
        typeof v === "number"
          ? v
          : typeof (v as any)?.id === "number"
          ? (v as any).id
          : typeof (v as any)?.move_id === "number"
          ? (v as any).move_id
          : undefined;
      if (typeId && typeof moveId === "number") {
        byType.set(typeId, moveId);
        idSet.add(moveId);
      }
    }
  } else if (Array.isArray(detail?.legacy_moves)) {
    for (const row of detail.legacy_moves) {
      const typeId = Number(row?.type_id ?? row?.type?.id);
      const moveId = Number(row?.move_id ?? row?.move?.id);
      if (typeId && moveId) {
        byType.set(typeId, moveId);
        idSet.add(moveId);
      }
    }
  }

  return { byType, idSet };
}

// Resolve legacy moves from IDs
function useLegacyMap(detail: any) {
  // Build pairs of { type_id, move_id } from either shape
  const pairs: Array<{ type_id: number; move_id: number }> = useMemo(() => {
    const out: Array<{ type_id: number; move_id: number }> = [];
    if (!detail) return out;

    if (detail.legacy_moves_by_type) {
      for (const [k, v] of Object.entries(detail.legacy_moves_by_type)) {
        const typeId = Number(k);
        const moveId =
          typeof v === "number"
            ? v
            : typeof (v as any)?.id === "number"
            ? (v as any).id
            : typeof (v as any)?.move_id === "number"
            ? (v as any).move_id
            : 0;
        if (typeId && moveId) out.push({ type_id: typeId, move_id: moveId });
      }
    } else if (Array.isArray(detail?.legacy_moves)) {
      for (const row of detail.legacy_moves) {
        const typeId = Number(row?.type_id ?? row?.type?.id ?? 0);
        const moveId = Number(row?.move_id ?? row?.move?.id ?? 0);
        if (typeId && moveId) out.push({ type_id: typeId, move_id: moveId });
      }
    }
    return out;
  }, [detail]);

  // Stable ids and map for re-association
  const moveIds = useMemo(
    () => Array.from(new Set(pairs.map((x) => x.move_id))),
    [pairs]
  );
  const moveIdToTypeId = useMemo(() => {
    const m = new Map<number, number>();
    pairs.forEach(({ type_id, move_id }) => m.set(move_id, type_id));
    return m;
  }, [pairs]);

  // Always invoked (even when moveIds is empty)
  const results = useQueries({
    queries: moveIds.map((id) => ({
      queryKey: ["move", id],
      queryFn: () => endpoints.moveById(id).then((r) => r.data as MoveOut),
      enabled: !!id, // harmless for 0
    })),
  });

  const loading = results.some((r) => r.isLoading);

  // Build the final map type_id -> MoveOut
  const legacyMap = useMemo(() => {
    const m = new Map<number, MoveOut>();
    results.forEach((r, idx) => {
      const move = r.data;
      if (!move) return;
      const moveId = moveIds[idx]!;
      const typeId = moveIdToTypeId.get(moveId);
      if (typeof typeId === "number") m.set(typeId, move);
    });
    return m;
  }, [results, moveIds, moveIdToTypeId]);

  return { legacyMap, loading };
}

// Type-safe key map for moveN fields
const moveKeys = {
  1: "move1_id",
  2: "move2_id",
  3: "move3_id",
  4: "move4_id",
} as const;
type MoveKey = typeof moveKeys[keyof typeof moveKeys];

// ---------- sections ----------
function MovesSection({
  slot,
  detail,
  legacyTypeId,
  onChange,
}: {
  slot: UserMonsterCreate;
  detail: any;
  legacyTypeId: ID;
  onChange: (patch: Partial<UserMonsterCreate>) => void;
}) {
  const { lang, t } = useI18n();
  const movePool: MoveOut[] = detail?.move_pool ?? [];

  // Resolve legacy moves from IDs
  const { legacyMap, loading: legacyLoading } = useLegacyMap(detail);

  // Candidates based on chosen type
  const allowedLegacy = legacyTypeId ? legacyMap.get(legacyTypeId) : undefined;
  const allLegacyMoves = useMemo(
    () => Array.from(legacyMap.values()),
    [legacyMap]
  );

  // Build select options
  const candidates: { move: MoveOut; isLegacy: boolean }[] = useMemo(() => {
    const base = movePool.map((m) => ({ move: m, isLegacy: false }));
    if (legacyTypeId) {
      if (allowedLegacy) base.unshift({ move: allowedLegacy, isLegacy: true });
    } else {
      // No legacy type yet: show all legacy moves (once loaded)
      if (!legacyLoading) {
        base.unshift(
          ...allLegacyMoves.map((m) => ({ move: m, isLegacy: true }))
        );
      }
    }
    return base;
  }, [movePool, allowedLegacy, legacyTypeId, allLegacyMoves, legacyLoading]);

  // Validation helpers
  const legacyIdSet = useMemo(
    () => new Set(allLegacyMoves.map((m) => m.id)),
    [allLegacyMoves]
  );
  const selectedIds = [
    slot.move1_id,
    slot.move2_id,
    slot.move3_id,
    slot.move4_id,
  ].filter(Boolean) as ID[];

  const setNth = (n: 1 | 2 | 3 | 4, id: ID) => {
    const key: MoveKey = moveKeys[n];
    onChange({ [key]: id } as any);
  };

  const canPick = (n: 1 | 2 | 3 | 4, move: MoveOut, isLegacy: boolean) => {
    const currentId = (slot as any)[moveKeys[n]] as ID;
    // no duplicates (unless it's the current select keeping the same value)
    if (move.id !== currentId && selectedIds.includes(move.id)) return false;

    if (!isLegacy) return true;

    // only one legacy among the four
    const selectedLegacyIds = selectedIds.filter((id) => legacyIdSet.has(id));
    const alreadyHasLegacy =
      selectedLegacyIds.length > 0 &&
      !(selectedLegacyIds.length === 1 && selectedLegacyIds[0] === currentId);
    if (alreadyHasLegacy) return false;

    // If a Legacy Type is chosen, only the matching legacy is included in candidates
    // If none chosen, any legacy is okay here (onPick will auto-set type).
    return true;
  };

  const onPick = (n: 1 | 2 | 3 | 4, opt: string) => {
    const id = Number(opt || 0) as ID;
    if (!id) {
      setNth(n, 0 as ID);
      return;
    }
    const found = candidates.find((c) => c.move.id === id);
    if (!found) {
      setNth(n, id);
      return;
    }

    if (found.isLegacy) {
      if (!legacyTypeId) {
        // auto-set type from chosen legacy
        let newTypeId: ID | undefined;
        for (const [tId, m] of legacyMap.entries()) {
          if (m.id === id) {
            newTypeId = Number(tId) as ID;
            break;
          }
        }
        if (newTypeId) {
          onChange({ legacy_type_id: newTypeId, [moveKeys[n]]: id } as any);
          return;
        }
      }
    }

    setNth(n, id);
  };

  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((n) => {
        const currentId = (slot as any)[moveKeys[n as 1 | 2 | 3 | 4]] as ID;

        const opts = candidates.map((c) => ({
          value: c.move.id,
          label: pickName(c.move as any, lang) || c.move.name,
          rightLabel: c.isLegacy ? `[${t("labels.legacy")}]` : undefined,
          disabled: !canPick(n as 1 | 2 | 3 | 4, c.move, c.isLegacy),
        }));

        return (
          <div key={n} className="flex items-center gap-2">
            <div className="w-16 text-xs text-zinc-500">{t("builder.moveN", { n })}</div>

            <div className="flex-1 min-w-0">
              <CustomSelect
                value={currentId || null}
                options={opts}
                placeholder="—"
                onChange={(id) => onPick(n as 1|2|3|4, String(id || ""))}
                containerClassName="flex-1 min-w-0"
                buttonClassName="w-full"
              />
            </div>
          </div>
        );
      })}

      <Warn>{t("builder.legacyHint")}</Warn>
    </div>
  );
}

function PersonalitySelect({
  value,
  options,
  onChange,
  placeholder,
}: {
  value?: number | null;
  options: PersonalityOut[];
  onChange: (id: number) => void;
  placeholder?: string;
}) {
  const { lang, t } = useI18n();

  const opts = (options ?? []).map((p) => ({
    value: p.id,
    label: pickName(p as any, lang),
    rightLabel: formatRowEffects(p, t), // shows e.g. [Mag Atk ↑, Phy Def ↓]
  }));

  return (
    <CustomSelect
      value={value ?? null}
      options={opts}
      placeholder={placeholder ?? t("common.select")}
      onChange={(id) => onChange(id)}
    />
  );
}

function PersonalitySection({
  slot,
  onChange,
}: {
  slot: UserMonsterCreate;
  onChange: (patch: Partial<UserMonsterCreate>) => void;
}) {
  const { lang, t } = useI18n();
  const { data } = useQuery({
    queryKey: ["personalities"],
    queryFn: () =>
      endpoints.personalities().then((r) => r.data as PersonalityOut[]),
  });

  const selected = (data ?? []).find((p) => p.id === slot.personality_id);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{t("builder.personality")}</div>

      <PersonalitySelect
        value={slot.personality_id || null}
        options={data ?? []}
        onChange={(id) => onChange({ personality_id: id })}
      />

      {selected && (
        <div className="text-xs text-emerald-700">
          {t("builder.effects", {
            text: formatSentenceEffects(selected, t),
          })}
        </div>
      )}
    </div>
  );
}

function LegacyTypeSection({
  slot,
  onChange,
  onLegacyChange,
}: {
  slot: UserMonsterCreate;
  onChange: (patch: Partial<UserMonsterCreate>) => void;
  onLegacyChange?: (newTypeId: ID) => void;
}) {
  const { lang, t } = useI18n();
  const { data } = useQuery({
    queryKey: ["types"],
    queryFn: () => endpoints.types().then((r) => r.data as TypeOut[]),
  });

  const opts = (data ?? []).map(type => ({
    value: type.id,
    label: pickName(type as any, lang),
  }));

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{t("builder.legacyType")}</div>

      <CustomSelect
        value={slot.legacy_type_id || null}
        options={opts}
        placeholder={t("common.select")}
        onChange={(v) => {
          const id = (Number(v || 0) as ID);
          onChange({ legacy_type_id: id });
          onLegacyChange?.(id);
        }}
      />
    </div>
  );
}

function TalentsSection({
  slot,
  onChange,
}: {
  slot: UserMonsterCreate;
  onChange: (patch: Partial<UserMonsterCreate>) => void;
}) {
  const { t } = useI18n();
  const allowed = [0, 7, 8, 9, 10];

  // Backend keys stored in state
  const KEYS: (keyof UserMonsterCreate["talent"])[] = [
    "hp_boost",
    "phy_atk_boost",
    "mag_atk_boost",
    "phy_def_boost",
    "mag_def_boost",
    "spd_boost",
  ];

  // Display labels (localized)
  const LABELS: Record<(typeof KEYS)[number], string> = {
    hp_boost: t("labels.hp"),
    phy_atk_boost: t("labels.phyAtk"),
    mag_atk_boost: t("labels.magAtk"),
    phy_def_boost: t("labels.phyDef"),
    mag_def_boost: t("labels.magDef"),
    spd_boost: t("labels.spd"),
  };

  function setTalent(k: (typeof KEYS)[number], v: number) {
    const tal = { ...(slot.talent || {}) };
    tal[k] = v;
    const boosted = KEYS.filter((k2) => (tal[k2] ?? 0) > 0).length;
    if (boosted > 3) {
      alert(t("builder.v_max3"));
      return;
    }
    onChange({ talent: tal });
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{t("builder.talents")}</div>
      <div className="grid grid-cols-2 gap-2">
        {KEYS.map((k) => {
          const value = slot.talent?.[k] ?? 0;
          const opts = allowed.map((n) => ({ value: n, label: String(n) }));
          return (
            <div key={k} className="flex items-center gap-2">
              <div className="w-24 text-xs text-zinc-600">{LABELS[k]}</div>
              <CustomSelect
                ariaLabel={LABELS[k]}
                value={value}
                options={opts}
                onChange={(v) => setTalent(k, v)}
                buttonClassName="min-w-[64px]"
              />
            </div>
          );
        })}
      </div>

      <Warn>{t("builder.talentsHint")}</Warn>
    </div>
  );
}

// ---------- main component ----------

export default function MonsterInspector({ activeIdx }: { activeIdx: number }) {
  const { slots, setSlot } = useBuilderStore();
  const slot = slots[activeIdx];

  // Call the data hook unconditionally with a safe id
  const monsterId = slot?.monster_id ?? 0;
  const detailQ = useMonsterDetail(monsterId);
  const detail = detailQ.data;

  const { lang, t } = useI18n();

  // Cast keeps TS happy with our store's stricter param type
  const onChange = (patch: Partial<UserMonsterCreate>) =>
    setSlot(activeIdx, patch as any);

  // Build a set/map we can use for normalization
  const { byType: legacyByType, idSet: legacyIdSet } = useMemo(
    () => extractLegacyInfo(detail),
    [detail]
  );

  const handleLegacyChange = (newTypeId: ID) => {
    const allowedMoveId = legacyByType.get(Number(newTypeId));
    const patch: Partial<UserMonsterCreate> = {};

    ([1, 2, 3, 4] as const).forEach((n) => {
      const key: MoveKey = moveKeys[n];
      const current = (slot as any)[key] as ID;
      // If this slot currently holds a legacy move and it's not the one allowed by the new type -> clear it
      if (
        current &&
        legacyIdSet.has(Number(current)) &&
        Number(current) !== Number(allowedMoveId ?? -1)
      ) {
        (patch as any)[key] = 0; // numeric zero
      }
    });

    if (Object.keys(patch).length) onChange(patch);
  };

  // For the green "grants…" line under Legacy Type
  const { legacyMap: legacyMapMain, loading: legacyLoadingMain } =
    useLegacyMap(detail);
  const allowedLegacyMain =
    slot?.legacy_type_id && legacyMapMain.get(slot.legacy_type_id);

  return (
    <aside className="rounded border bg-white p-3 space-y-4">
      <div className="font-medium">
        {t("builder.inspectorTitle", { n: activeIdx + 1 })}
      </div>

      {!slot ? (
        <div className="text-sm text-zinc-600">{t("builder.pickAMonster")}</div>
      ) : !slot.monster_id ? (
        <>
          <MonsterPicker onPick={(m) => onChange({ monster_id: m.id })} />
          <div className="text-[11px] text-zinc-600">{t("builder.tipAfterPick")}</div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-end">
            <button
              className="text-xs rounded cursor-pointer hover:text-zinc-900 hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              onClick={() =>
                onChange({ monster_id: 0, move1_id: 0, move2_id: 0, move3_id: 0, move4_id: 0 })
              }
              title={t('builder.changeMonster')}
            >
              {t("builder.changeMonster")}
            </button>
          </div>

          <PersonalitySection slot={slot} onChange={onChange} />

          <LegacyTypeSection slot={slot} onChange={onChange} onLegacyChange={handleLegacyChange}/>

          {/* Note line: "Legacy Type grants ..." */}
          {slot.legacy_type_id ? (
            legacyLoadingMain ? (
              <div className="text-xs text-zinc-500">{t("common.loading")}</div>
            ) : allowedLegacyMain ? (
              <div className="text-xs text-emerald-700">
                {t("builder.legacyGrants", {
                  name:
                    pickName(allowedLegacyMain as any, lang) ||
                    allowedLegacyMain.name,
                })}
              </div>
            ) : (
              <div className="text-xs text-amber-700">
                {t("builder.legacyMissing")}
              </div>
            )
          ) : null}

          <div>
            <div className="text-sm font-medium mb-1">{t("builder.moves")}</div>
            {detailQ.isLoading ? (
              <div className="text-xs text-zinc-500">{t("common.loading")}</div>
            ) : (
              <MovesSection
                slot={slot}
                detail={detail}
                legacyTypeId={slot.legacy_type_id || 0}
                onChange={onChange}
              />
            )}
          </div>

          <TalentsSection slot={slot} onChange={onChange} />
        </>
      )}
    </aside>
  );
}