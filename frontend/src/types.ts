export type ID = number;

export interface TypeOut { id: ID; name: string; }
export interface TraitOut { id: ID; name: string; }
export type MoveCategory = "ATTACK" | "DEFENSE" | "STATUS";

export interface MoveOut {
  id: ID;
  name: string;
  type: TypeOut;
  category: MoveCategory;
  has_counter?: boolean;
  is_move_stone?: boolean;
}

export interface PersonalityOut {
  id: ID; name: string;
  hp_mod_pct: number; phy_atk_mod_pct: number; mag_atk_mod_pct: number;
  phy_def_mod_pct: number; mag_def_mod_pct: number; spd_mod_pct: number;
}

export interface MonsterLiteOut {
  id: ID; name: string; form: string;
  main_type: TypeOut; sub_type?: TypeOut | null;
  leader_potential?: boolean; is_leader_form?: boolean;
}

export interface MagicItemOut {
  id: ID; name: string;
  // optional: allowed types/constraints if backend exposes it
}

export interface TalentUpsert {
  hp_boost: number; phy_atk_boost: number; mag_atk_boost: number;
  phy_def_boost: number; mag_def_boost: number; spd_boost: number;
}

export interface UserMonsterCreate {
  monster_id: ID;
  personality_id: ID;
  legacy_type_id: ID;
  move1_id: ID; move2_id: ID; move3_id: ID; move4_id: ID;
  talent: TalentUpsert;
}

export interface TeamCreate {
  name: string;
  magic_item_id: ID | null;
  user_monsters: UserMonsterCreate[]; // length 6
}

export interface TeamAnalysisOut {
  // Keep loose; render what backend returns
  team_weak_to?: string[];
  valid_targets?: number[];
  recommendations?: string[];
  monsters?: Array<{
    monster_id: ID;
    effective_stats?: Record<string, number>;
    energy_profile?: any;
    counter_coverage?: any;
    trait_synergies?: string[];
  }>;
}

export interface LocalizedName { [key: string]: any } // flexible
export interface Named {
  name: string;
  localized?: LocalizedName;
}

export interface TypeOut extends Named { id: ID; }
export interface TraitOut extends Named { id: ID; }
export interface MoveOut extends Named {
  id: ID;
  type: TypeOut;
  category: MoveCategory;
  has_counter?: boolean;
  is_move_stone?: boolean;
}
export interface MonsterLiteOut extends Named {
  id: ID; form: string;
  main_type: TypeOut; sub_type?: TypeOut | null;
  leader_potential?: boolean; is_leader_form?: boolean;
}