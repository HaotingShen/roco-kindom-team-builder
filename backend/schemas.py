from pydantic import BaseModel, model_validator, Field
from typing import Optional, List, Dict, Any, ClassVar
from enum import Enum

class PageMeta(BaseModel):
    total: int
    limit: int
    offset: int

class Page(BaseModel):
    meta: PageMeta
    items: List[Any]
    
class MoveCategory(str, Enum):
    PHY_ATTACK = "Physical Attack"
    MAG_ATTACK = "Magic Attack"
    DEFENSE = "Defense"
    STATUS = "Status"

class TypeOut(BaseModel):
    id: int
    name: str
    localized: Dict
    
    class Config:
        from_attributes = True

class TraitOut(BaseModel):
    id: int
    name: str
    description: str
    localized: Dict
    
    class Config:
        from_attributes = True

class PersonalityOut(BaseModel):
    id: int
    name: str
    hp_mod_pct: float
    phy_atk_mod_pct: float
    mag_atk_mod_pct: float
    phy_def_mod_pct: float
    mag_def_mod_pct: float
    spd_mod_pct: float
    localized: Dict

    class Config:
        from_attributes = True

# Simplified version of MoveOut
class MoveLiteOut(BaseModel):
    id: int
    name: str
    move_type: Optional[TypeOut] = None
    localized: Dict

    class Config:
        from_attributes = True

# Full version of MoveOut
class MoveOut(MoveLiteOut):
    move_category: MoveCategory
    energy_cost: int
    power: Optional[int] = None
    description: str
    is_move_stone: bool

    class Config:
        from_attributes = True

class LegacyMoveOut(BaseModel):
    monster_id: int
    type_id: int
    move_id: int

    class Config:
        from_attributes = True
        
class MonsterSpeciesOut(BaseModel):
    id: int
    name: str
    localized: Dict

    class Config:
        from_attributes = True

# Simplified version of MonsterOut
class MonsterLiteOut(BaseModel):
    id: int
    name: str
    form: str
    main_type: TypeOut
    sub_type: Optional[TypeOut] = None
    is_leader_form: bool
    localized: Dict

    class Config:
        from_attributes = True

# Full version of MonsterOut
class MonsterOut(MonsterLiteOut):
    evolves_from_id: Optional[int] = None
    species: MonsterSpeciesOut
    trait: TraitOut
    base_hp: int
    base_phy_atk: int
    base_mag_atk: int
    base_phy_def: int
    base_mag_def: int
    base_spd: int
    move_pool: List[MoveOut]
    legacy_moves: List[LegacyMoveOut]

    class Config:
        from_attributes = True
        
class MagicItemOut(BaseModel):
    id: int
    name: str
    description: str
    localized: Dict

    class Config:
        from_attributes = True

class GameTermOut(BaseModel):
    id: int
    key: str
    description: str
    localized: Dict

    class Config:
        from_attributes = True
        
class TalentIn(BaseModel):
    hp_boost: int = 0
    phy_atk_boost: int = 0
    mag_atk_boost: int = 0
    phy_def_boost: int = 0
    mag_def_boost: int = 0
    spd_boost: int = 0
    
    allowed_boosts: ClassVar[set] = {0, 7, 8, 9, 10}

    @model_validator(mode="after")
    def check_boosts(self) -> "TalentIn":
        boosts = [
            self.hp_boost,
            self.phy_atk_boost,
            self.mag_atk_boost,
            self.phy_def_boost,
            self.mag_def_boost,
            self.spd_boost,
        ]
        # Check allowed values
        if not all(b in self.allowed_boosts for b in boosts):
            raise ValueError(f"Each boost must be one of {self.allowed_boosts}")
        # Check max number of boosted stats
        boosted_count = sum(1 for b in boosts if b != 0)
        if boosted_count > 3:
            raise ValueError("At most 3 stats can be boosted")
        return self

class TalentOut(TalentIn):
    id: int

    class Config:
        orm_mode = True

class UserMonsterCreate(BaseModel):
    monster_id: int
    personality_id: int
    legacy_type_id: int
    move1_id: int
    move2_id: int
    move3_id: int
    move4_id: int
    talent: TalentIn

class UserMonsterOut(BaseModel):
    id: int
    monster: MonsterLiteOut
    personality: PersonalityOut
    legacy_type: TypeOut
    move1: MoveOut
    move2: MoveOut
    move3: MoveOut
    move4: MoveOut
    talent: TalentOut
    team_id: Optional[int] = None

    class Config:
        from_attributes = True

class TeamCreate(BaseModel):
    name: Optional[str] = None
    user_monsters: List[UserMonsterCreate] = Field(..., min_items=6, max_items=6)
    magic_item_id: int

class TeamOut(BaseModel):
    id: int
    name: Optional[str] = None
    user_monsters: List[UserMonsterOut]
    magic_item: MagicItemOut

    class Config:
        from_attributes = True

class TeamAnalyzeByIdRequest(BaseModel):
    team_id: int

class TeamAnalyzeInlineRequest(BaseModel):
    team: TeamCreate

class EffectiveStats(BaseModel):
    hp: int
    phy_atk: int
    mag_atk: int
    phy_def: int
    mag_def: int
    spd: int
    
class EnergyProfile(BaseModel):
    avg_energy_cost: float
    has_zero_cost_move: bool
    has_energy_restore_move: bool
    zero_cost_moves: List[int] = []
    energy_restore_moves: List[int] = []
    
class CounterCoverage(BaseModel):
    has_attack_counter_status: bool
    has_defense_counter_attack: bool
    has_status_counter_defense: bool
    total_counter_moves: int
    counter_move_ids: List[int] = []

class TypeCoverageReport(BaseModel):
    covered_types: List[int]
    missing_types: List[int]
    team_weak_to: List[int]

class TraitSynergyFinding(BaseModel):
    monster_id: int
    trait: TraitOut
    synergy_moves: List[int] = []
    anti_synergy_moves: List[int] = []
    recommendation: List[str] = []

class MagicItemEvaluation(BaseModel):
    chosen_item: MagicItemOut
    valid_targets: List[int]  # user_monster ids
    best_target_monster_id: Optional[int] = None
    reasoning: Optional[str] = None

class MonsterAnalysisOut(BaseModel):
    user_monster: UserMonsterOut
    effective_stats: EffectiveStats
    energy_profile: EnergyProfile
    counter_coverage: CounterCoverage
    trait_synergies: List[TraitSynergyFinding] = []

class TeamAnalysisOut(BaseModel):
    team: TeamOut
    per_monster: List[MonsterAnalysisOut]
    type_coverage: TypeCoverageReport
    magic_item_eval: MagicItemEvaluation
    recommendations: List[str] = []