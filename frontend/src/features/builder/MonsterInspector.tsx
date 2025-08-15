import { useQuery, useQueries } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { useI18n, pickName } from "@/i18n";
import MonsterPicker from "./MonsterPicker";
import { useBuilderStore } from "./builderStore";
import type {
  ID,
  MoveOut,
  PersonalityOut,
  TypeOut,
  UserMonsterCreate,
} from "@/types";
import { useMemo, useEffect, useRef, useState } from "react";

// ---------- helpers ----------

function useMonsterDetail(monsterId: ID | 0) {
  return useQuery({
    queryKey: ["monster", monsterId],
    queryFn: () => endpoints.monsterById(monsterId!).then((r) => r.data),
    enabled: !!monsterId,
  });
}

// --- Personality effect formatters ---
const EFFECT_FIELDS = [
  ["HP", "hp_mod_pct"],
  ["Phy Atk", "phy_atk_mod_pct"],
  ["Mag Atk", "mag_atk_mod_pct"],
  ["Phy Def", "phy_def_mod_pct"],
  ["Mag Def", "mag_def_mod_pct"],
  ["Speed", "spd_mod_pct"],
] as const;

function getEffects(p: PersonalityOut) {
  return EFFECT_FIELDS.map(([label, key]) => [label, (p as any)[key] as number] as const);
}

// Row text on the right, e.g. [Mag Atk ↑, Phy Def ↓]
function formatRowEffects(p: PersonalityOut) {
  const ups = getEffects(p).filter(([, v]) => v > 0).map(([n]) => `${n} ↑`);
  const downs = getEffects(p).filter(([, v]) => v < 0).map(([n]) => `${n} ↓`);
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
function formatSentenceEffects(p: PersonalityOut) {
  const items = getEffects(p).filter(([, v]) => v !== 0);
  if (!items.length) return "None";
  // positives first, then negatives (just a nicety)
  const ordered = [...items.filter(([, v]) => v > 0), ...items.filter(([, v]) => v < 0)];
  return ordered.map(([n, v]) => `${n} ${pct(v)}`).join(", ");
}

// Build maps using raw IDs (no network fetch needed)
function extractLegacyInfo(detail: any): {
  byType: Map<number, number>;   // type_id -> move_id
  idSet: Set<number>;            // all legacy move ids
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
  onChange
}: {
  slot: UserMonsterCreate;
  detail: any;
  legacyTypeId: ID;
  onChange: (patch: Partial<UserMonsterCreate>) => void;
}) {
  const { lang } = useI18n();
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
        base.unshift(...allLegacyMoves.map((m) => ({ move: m, isLegacy: true })));
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
        return (
          <div key={n} className="flex items-center gap-2">
            <div className="w-16 text-xs text-zinc-500">Move {n}</div>
            <select
              value={currentId || ""}
              onChange={(e) => onPick(n as 1 | 2 | 3 | 4, e.target.value)}
              className="h-9 border rounded px-2 flex-1"
            >
              <option value="">—</option>
              {candidates.map((c) => (
                <option
                  key={`${c.isLegacy ? "L" : "N"}-${c.move.id}`}
                  value={c.move.id}
                  disabled={!canPick(n as 1 | 2 | 3 | 4, c.move, c.isLegacy)}
                >
                  {pickName(c.move as any, lang) || c.move.name}
                  {c.isLegacy ? "  [Legacy]" : ""}
                </option>
              ))}
            </select>
          </div>
        );
      })}

      <div className="text-[11px] text-zinc-500">
        You can pick <b>at most 1</b> Legacy move, and it must match the selected
        Legacy Type.
      </div>
    </div>
  );
}

function PersonalitySelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
}: {
  value?: number | null;
  options: PersonalityOut[];
  onChange: (id: number) => void;
  placeholder?: string;
}) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (popRef.current && !popRef.current.contains(t) && btnRef.current && !btnRef.current.contains(t)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = options.find((p) => p.id === value);

  return (
    <div className="relative">
      {/* Closed button: name ONLY (no effects) */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-full border rounded px-3 flex items-center justify-between"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{current ? pickName(current as any, lang) : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 7l5 6 5-6" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          ref={popRef}
          role="listbox"
          className="absolute z-20 mt-1 w-full border rounded bg-white shadow max-h-72 overflow-auto"
        >
          {options.map((p) => {
            const selected = p.id === value;
            return (
              <div
                key={p.id}
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(p.id); setOpen(false); }}
                className={`px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-zinc-50 ${
                  selected ? "bg-zinc-100" : ""
                }`}
              >
                {/* localized row label */}
                <span className="truncate">{pickName(p as any, lang)}</span>
                <span className="ml-auto text-right text-xs text-zinc-600">
                  {formatRowEffects(p)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PersonalitySection({
  slot,
  onChange,
}: {
  slot: UserMonsterCreate;
  onChange: (patch: Partial<UserMonsterCreate>) => void;
}) {
  const { data } = useQuery({
    queryKey: ["personalities"],
    queryFn: () =>
      endpoints.personalities().then((r) => r.data as PersonalityOut[]),
  });

  const selected = (data ?? []).find((p) => p.id === slot.personality_id);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Personality</div>

      <PersonalitySelect
        value={slot.personality_id || null}
        options={data ?? []}
        onChange={(id) => onChange({ personality_id: id })}
      />

      {selected && (
        <div className="text-xs text-zinc-600">
          Effects: <span className="font-medium">{formatSentenceEffects(selected)}</span>
        </div>
      )}
    </div>
  );
}

function LegacyTypeSection({
  slot,
  onChange,
  onLegacyChange
}: {
  slot: UserMonsterCreate;
  onChange: (patch: Partial<UserMonsterCreate>) => void;
  onLegacyChange?: (newTypeId: ID) => void;
}) {
  const { lang } = useI18n();
  const { data } = useQuery({
    queryKey: ["types"],
    queryFn: () => endpoints.types().then(r => r.data as TypeOut[])
  });

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">Legacy Type</div>
      <select
        value={slot.legacy_type_id || ""}
        onChange={e => {
          const v = Number(e.target.value || 0) as ID;
          onChange({ legacy_type_id: v });
          onLegacyChange?.(v);
        }}
        className="h-9 border rounded px-2 w-full"
      >
        <option value="">Select…</option>
        {(data ?? []).map(t => (
          <option key={t.id} value={t.id}>
            {pickName(t as any, lang)}   {/* localized type name */}
          </option>
        ))}
      </select>
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

  // Display labels
  const LABELS: Record<(typeof KEYS)[number], string> = {
    hp_boost: "HP",
    phy_atk_boost: "Phy Atk",
    mag_atk_boost: "Mag Atk",
    phy_def_boost: "Phy Def",
    mag_def_boost: "Mag Def",
    spd_boost: "Speed",
  };

  function setTalent(k: (typeof KEYS)[number], v: number) {
    const t = { ...(slot.talent || {}) };
    t[k] = v;
    const boosted = KEYS.filter((k2) => (t[k2] ?? 0) > 0).length;
    if (boosted > 3) {
      alert("At most 3 stats can be boosted.");
      return;
    }
    onChange({ talent: t });
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Talents</div>
      <div className="grid grid-cols-2 gap-2">
        {KEYS.map((k) => (
          <div key={k} className="flex items-center gap-2">
            {/* removed `uppercase`; use friendly label */}
            <div className="w-24 text-xs text-zinc-600">{LABELS[k]}</div>
            <select
              aria-label={LABELS[k]}
              value={slot.talent?.[k] ?? 0}
              onChange={(e) => setTalent(k, Number(e.target.value))}
              className="h-9 border rounded px-2"
            >
              {allowed.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-zinc-500">
        Note: At most 3 stats can be boosted.
      </div>
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

  const { lang } = useI18n();

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

    ( [1,2,3,4] as const ).forEach(n => {
      const key: MoveKey = moveKeys[n];
      const current = (slot as any)[key] as ID;
      // If this slot currently holds a legacy move and it's not the one allowed by the new type -> clear it
      if (current && legacyIdSet.has(Number(current)) && Number(current) !== Number(allowedMoveId ?? -1)) {
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
      <div className="font-medium">Inspector — Slot {activeIdx + 1}</div>

      {!slot ? (
        <div className="text-sm text-zinc-600">
          Select a valid slot on the left to configure.
        </div>
      ) : !slot.monster_id ? (
        <>
          <MonsterPicker onPick={(m) => onChange({ monster_id: m.id })} />
          <div className="text-[11px] text-zinc-500">
            Tip: After choosing a monster, you can set Personality, Legacy Type,
            Moves, and Talents.
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-end">
            <button
              className="text-xs underline"
              onClick={() =>
                onChange({
                  monster_id: 0,
                  move1_id: 0,
                  move2_id: 0,
                  move3_id: 0,
                  move4_id: 0,
                })
              }
            >
              Change Monster
            </button>
          </div>

          <PersonalitySection slot={slot} onChange={onChange} />

          <LegacyTypeSection
            slot={slot}
            onChange={onChange}
            onLegacyChange={handleLegacyChange}
          />

          {/* Moved here: "Legacy Type grants ..." */}
          {slot.legacy_type_id ? (
            legacyLoadingMain ? (
              <div className="text-xs text-zinc-500">Loading legacy move…</div>
            ) : allowedLegacyMain ? (
              <div className="text-xs text-emerald-700">
                Legacy Type grants:{" "}
                <b>
                  {pickName(allowedLegacyMain as any, lang) ||
                    allowedLegacyMain.name}
                </b>
                . You can use it in one move slot.
              </div>
            ) : (
              <div className="text-xs text-amber-700">
                No legacy move found for this Legacy Type.
              </div>
            )
          ) : null}

          <div>
            <div className="text-sm font-medium mb-1">Moves</div>
            {detailQ.isLoading ? (
              <div className="text-xs text-zinc-500">Loading move pool…</div>
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