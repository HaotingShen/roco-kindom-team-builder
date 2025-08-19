import { create } from "zustand";
import type { ID, UserMonsterCreate, TeamCreate, TalentUpsert, TeamAnalysisOut } from "@/types";

const emptyTalent: TalentUpsert = {
  hp_boost: 0,
  phy_atk_boost: 0,
  mag_atk_boost: 0,
  phy_def_boost: 0,
  mag_def_boost: 0,
  spd_boost: 0,
};

function emptySlot(): UserMonsterCreate {
  return {
    monster_id: 0,
    personality_id: 0,
    legacy_type_id: 0,
    move1_id: 0,
    move2_id: 0,
    move3_id: 0,
    move4_id: 0,
    talent: { ...emptyTalent },
  };
}

// --- helpers to keep TS happy ---
type PartialNoUndef<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

function mergeWithoutUndef<T extends object>(base: T, patch: PartialNoUndef<T>): T {
  const next: any = { ...base };
  for (const k in patch) {
    const v = (patch as any)[k];
    if (v !== undefined) next[k] = v;
  }
  return next as T;
}

type BuilderState = {
  name: string;
  magic_item_id: ID | null;
  slots: UserMonsterCreate[]; // length 6
  setName: (v: string) => void;
  setMagicItem: (id: ID | null) => void;
  setSlot: (idx: number, patch: PartialNoUndef<UserMonsterCreate>) => void;
  toPayload: () => TeamCreate;
  analysis: TeamAnalysisOut | null;
  setAnalysis: (a: TeamAnalysisOut | null) => void;
  reset: () => void;
};

export const useBuilderStore = create<BuilderState>((set, get) => ({
  name: "My Team",
  magic_item_id: null,
  slots: Array.from({ length: 6 }, emptySlot),
  setName: (name) => set({ name }),
  setMagicItem: (magic_item_id) => set({ magic_item_id }),
  setSlot: (idx, patch) =>
    set((s) => {
      const slots = s.slots.slice();
      const current = slots[idx] ?? emptySlot();
      const next = mergeWithoutUndef<UserMonsterCreate>(current, patch);
      slots[idx] = next;
      return { slots };
    }),
  toPayload: () => {
    const s = get();

    // Enforce required magic item
    if (s.magic_item_id == null) {
      throw new Error("Magic item is required before analyzing.");
    }

    return {
      name: s.name,
      magic_item_id: s.magic_item_id,
      user_monsters: s.slots,
    };
  },
  analysis: null,
  setAnalysis: (a) => set({ analysis: a }),
  reset: () =>
    set({
      name: "My Team",
      magic_item_id: null,
      slots: Array.from({ length: 6 }, emptySlot),
      analysis: null,
    }),
}));