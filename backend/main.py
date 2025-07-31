from fastapi import FastAPI, Depends, Query, HTTPException
from sqlalchemy.orm import Session, sessionmaker, joinedload
from sqlalchemy import create_engine, or_
from config import DATABASE_URL
from typing import Optional, List
import models, schemas
import re

app = FastAPI()

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to roco kindom!"}

# === Game Data Endpoints ===
@app.get("/monsters/", response_model=List[schemas.MonsterLiteOut])
def get_monsters(
    db: Session = Depends(get_db),
    name: Optional[str] = Query(None),
    type_id: Optional[int] = Query(None),
    trait_id: Optional[int] = Query(None),
    is_leader_form: Optional[bool] = Query(None),
    limit: int = Query(117, ge=1, le=117),
    offset: int = Query(0, ge=0)
):
    query = db.query(models.Monster).options(
        joinedload(models.Monster.main_type),
        joinedload(models.Monster.sub_type)
    )
    if name:
        query = query.filter(models.Monster.name.ilike(f"%{name}%"))
    if type_id:
        query = query.filter(
            or_(
                models.Monster.main_type_id == type_id,
                models.Monster.sub_type_id == type_id
            )
        )
    if trait_id:
        query = query.filter(models.Monster.trait_id == trait_id)
    if is_leader_form is not None:
        query = query.filter(models.Monster.is_leader_form == is_leader_form)
    return query.offset(offset).limit(limit).all()

@app.get("/monsters/{monster_id}", response_model=schemas.MonsterOut)
def get_monster_detail(monster_id: int, db: Session = Depends(get_db)):
    monster = db.query(models.Monster).options(
        joinedload(models.Monster.main_type),
        joinedload(models.Monster.sub_type),
        joinedload(models.Monster.trait),
        joinedload(models.Monster.species),
        joinedload(models.Monster.move_pool).joinedload(models.Move.move_type)
    ).filter(models.Monster.id == monster_id).first()
    if not monster:
        raise HTTPException(status_code=404, detail="Monster not found")
    return monster


@app.get("/moves/", response_model=List[schemas.MoveLiteOut])
def get_moves(
    db: Session = Depends(get_db),
    name: Optional[str] = Query(None),
    move_type_id: Optional[int] = Query(None),
    move_category: Optional[schemas.MoveCategory] = Query(None),
    has_counter: Optional[bool] = Query(None),
    is_move_stone: Optional[bool] = Query(None),
    limit: int = Query(468, ge=1, le=468),
    offset: int = Query(0, ge=0),
):
    query = db.query(models.Move).options(
        joinedload(models.Move.move_type)
    )
    if name:
        query = query.filter(models.Move.name.ilike(f"%{name}%"))
    if move_type_id:
        query = query.filter(models.Move.move_type_id == move_type_id)
    if move_category:
        query = query.filter(models.Move.move_category == models.MoveCategory(move_category.value))
    if has_counter is not None:
        query = query.filter(models.Move.has_counter == has_counter)
    if is_move_stone is not None:
        query = query.filter(models.Move.is_move_stone == is_move_stone)
    return query.offset(offset).limit(limit).all()

@app.get("/moves/{move_id}", response_model=schemas.MoveOut)
def get_move_detail(move_id: int, db: Session = Depends(get_db)):
    move = db.query(models.Move).options(
        joinedload(models.Move.move_type)
    ).filter(models.Move.id == move_id).first()
    if not move:
        raise HTTPException(status_code=404, detail="Move not found")
    return move


@app.get("/traits/", response_model=List[schemas.TraitOut])
def get_traits(db: Session = Depends(get_db)):
    return db.query(models.Trait).all()


@app.get("/types/", response_model=List[schemas.TypeOut])
def get_types(db: Session = Depends(get_db)):
    return db.query(models.Type).all()


@app.get("/personalities/", response_model=List[schemas.PersonalityOut])
def get_personalities(db: Session = Depends(get_db)):
    return db.query(models.Personality).all()


@app.get("/magic_items/", response_model=List[schemas.MagicItemOut])
def get_magic_items(db: Session = Depends(get_db)):
    return db.query(models.MagicItem).all()


@app.get("/game_terms/", response_model=List[schemas.GameTermOut])
def get_game_terms(db: Session = Depends(get_db)):
    return db.query(models.GameTerm).all()


@app.get("/species/", response_model=List[schemas.MonsterSpeciesOut])
def get_species(db: Session = Depends(get_db)):
    return db.query(models.MonsterSpecies).all()


# -------- POST: Create Team --------

@app.post("/teams/", response_model=schemas.TeamOut)
def create_team(team: schemas.TeamCreate, db: Session = Depends(get_db)):
    # Persist the team and its monsters to DB
    db_team = models.Team(name=team.name, magic_item_id=team.magic_item_id)
    db.add(db_team)
    db.flush()

    user_monsters_out = []
    for um in team.user_monsters:
        db_um = models.UserMonster(
            monster_id=um.monster_id,
            personality_id=um.personality_id,
            legacy_type_id=um.legacy_type_id,
            move1_id=um.move1_id,
            move2_id=um.move2_id,
            move3_id=um.move3_id,
            move4_id=um.move4_id,
            team_id=db_team.id
        )
        db.add(db_um)
        db.flush()
        db_talent = models.Talent(
            monster_instance_id=db_um.id,
            hp_boost=um.talent.hp_boost,
            phy_atk_boost=um.talent.phy_atk_boost,
            mag_atk_boost=um.talent.mag_atk_boost,
            phy_def_boost=um.talent.phy_def_boost,
            mag_def_boost=um.talent.mag_def_boost,
            spd_boost=um.talent.spd_boost
        )
        db.add(db_talent)
        db_um.talent = db_talent
        user_monsters_out.append(db_um)  # For future expand reference
    db.commit()

    # Re-fetch with relationships for output schema
    db.refresh(db_team)
    return db_team

# -------- POST: Analyze Team (Inline) --------

@app.post("/team/analyze/", response_model=schemas.TeamAnalysisOut)
def analyze_team(req: schemas.TeamAnalyzeInlineRequest, db: Session):
    team_data = req.team  # This is TeamCreate (with 6 UserMonsterCreate)
    
    # Load all referenced DB objects in one go for efficiency (monsters, moves, types, traits, etc.)
    # Build index by ID for quick lookups
    monster_db_map = {m.id: m for m in db.query(models.Monster).all()}
    move_db_map = {m.id: m for m in db.query(models.Move).all()}
    type_db_map = {t.id: t for t in db.query(models.Type).all()}
    trait_db_map = {t.id: t for t in db.query(models.Trait).all()}
    personality_db_map = {p.id: p for p in db.query(models.Personality).all()}
    magic_item_db_map = {i.id: i for i in db.query(models.MagicItem).all()}
    
    # Build UserMonsterOuts (with full nested data) and compute per-monster analysis
    user_monster_outs = []
    per_monster_analysis = []
    for i, um in enumerate(team_data.user_monsters):
        base_monster = monster_db_map[um.monster_id]
        personality = personality_db_map[um.personality_id]
        legacy_type = type_db_map[um.legacy_type_id]
        move1 = move_db_map[um.move1_id]
        move2 = move_db_map[um.move2_id]
        move3 = move_db_map[um.move3_id]
        move4 = move_db_map[um.move4_id]
        talent = um.talent
        
        # Compute effective stats with base, talent, and personality multipliers
        def compute_effective_stats(monster, personality, talent):
            # Helper to get modifier from personality
            def mod(attr):
                return getattr(personality, f"{attr}_mod_pct", 0.0)

            # HP formula: hp = [1.7 × (base_stats + hp_talent × 6) + 70 − 2.55 × hp_talent] × (1 + hp_personality_modifier) + 100
            base_hp = monster.base_hp
            hp_talent = talent.hp_boost
            hp = (1.7 * (base_hp + hp_talent * 6) + 70 - 2.55 * hp_talent)
            hp = hp * (1 + mod("hp"))
            hp = int(round(hp + 100))  # Round to nearest integer

            # other stats = round(1.1 × (base_stats + talent × 6) + 10) × (1 + personality_modifier) + 50
            def other_stat(attr, talent_attr):
                base = getattr(monster, attr)
                tal = getattr(talent, talent_attr)
                val = 1.1 * (base + tal * 6) + 10
                val = round(val) * (1 + mod(attr))
                val = int(round(val + 50))
                return val

            return schemas.EffectiveStats(
                hp=hp,
                phy_atk=other_stat("base_phy_atk", "phy_atk_boost"),
                mag_atk=other_stat("base_mag_atk", "mag_atk_boost"),
                phy_def=other_stat("base_phy_def", "phy_def_boost"),
                mag_def=other_stat("base_mag_def", "mag_def_boost"),
                spd=other_stat("base_spd", "spd_boost"),
            )
            
        # Compute energy profile for moves, including average cost, zero-cost moves, and energy restore moves
        def compute_energy_profile(moves):
            # moves: list of 4 move SQLAlchemy objects, each with .energy_cost
                costs = [getattr(m, "energy_cost", None) for m in moves if m is not None]
                costs = [c for c in costs if c is not None]

                avg_cost = sum(costs) / len(costs) if costs else 0.0
                zero_cost_moves = [m.id for m in moves if m and getattr(m, "energy_cost", None) == 0]
                has_zero_cost = len(zero_cost_moves) > 0

                # Energy restore pattern
                energy_patterns = [
                    r"gain[s]? \w+ energy",
                    r"restore[s]? \w+ energy",
                    r"steal[s]? \w+ energy",
                    r"gain[s]? energy",
                    r"restore[s]? energy"
                ]
                combined_pattern = re.compile("|".join(energy_patterns), flags=re.IGNORECASE)

                energy_restore_moves = [
                    m.id for m in moves
                    if m and hasattr(m, "description") and m.description and combined_pattern.search(m.description)
                ]
                has_energy_restore = len(energy_restore_moves) > 0

                return schemas.EnergyProfile(
                    avg_energy_cost=round(avg_cost, 2),
                    has_zero_cost_move=has_zero_cost,
                    has_energy_restore_move=has_energy_restore,
                    zero_cost_moves=zero_cost_moves,
                    energy_restore_moves=energy_restore_moves
                )

        # Compute counter coverage for moves with attack/defense/status counters
        def compute_counter_coverage(moves):
            # moves: list of 4 move SQLAlchemy objects, each with .move_category and .has_counter
            has_attack_counter_status = False
            has_defense_counter_attack = False
            has_status_counter_defense = False
            counter_move_ids = []

            for m in moves:
                if not m or not getattr(m, "has_counter", False):
                    continue
                counter_move_ids.append(m.id)
                cat = getattr(m, "move_category", None)
                if cat == "Physical Attack" or cat == "Magic Attack" or str(cat) == "MoveCategory.PHY_ATTACK" or str(cat) == "MoveCategory.MAG_ATTACK":
                    has_attack_counter_status = True
                elif cat == "Defense" or str(cat) == "MoveCategory.DEFENSE":
                    has_defense_counter_attack = True
                elif cat == "Status" or str(cat) == "MoveCategory.STATUS":
                    has_status_counter_defense = True
                
            return schemas.CounterCoverage(
                has_attack_counter_status=has_attack_counter_status,
                has_defense_counter_attack=has_defense_counter_attack,
                has_status_counter_defense=has_status_counter_defense,
                total_counter_moves=len(counter_move_ids),
                counter_move_ids=counter_move_ids
            )

        effective_stats = compute_effective_stats(base_monster, personality, talent)
        energy_profile = compute_energy_profile([move1, move2, move3, move4])
        counter_coverage = compute_counter_coverage([move1, move2, move3, move4])
        # ... trait synergies, etc.

        # Build UserMonsterOut
        user_monster_out = schemas.UserMonsterOut(
            id=i,
            monster=to_monster_lite_out(base_monster, type_db_map, trait_db_map),
            personality=schemas.PersonalityOut(**personality.__dict__),
            legacy_type=schemas.TypeOut(**legacy_type.__dict__),
            move1=schemas.MoveOut(**move1.__dict__),
            move2=schemas.MoveOut(**move2.__dict__),
            move3=schemas.MoveOut(**move3.__dict__),
            move4=schemas.MoveOut(**move4.__dict__),
            talent=schemas.TalentOut(id=i, **talent.dict()),
        )
        
        user_monster_outs.append(user_monster_out)

        # Build MonsterAnalysisOut
        monster_analysis = schemas.MonsterAnalysisOut(
            user_monster=user_monster_out,
            effective_stats=effective_stats,
            energy_profile=energy_profile,
            counter_coverage=counter_coverage,
            trait_synergies=[] # You’ll add this logic later
        )
        per_monster_analysis.append(monster_analysis)
    
    # 3. Compute team-level analysis
    type_coverage = compute_type_coverage([move1, move2, move3, move4, ...])
    magic_item_eval = compute_magic_item_eval(team_data.magic_item_id, magic_item_db_map, user_monster_outs)
    recommendations = []  # Can be filled with rule-based or LLM-based advice

    # 4. Build TeamOut and TeamAnalysisOut (final response)
    magic_item_out = schemas.MagicItemOut(**magic_item_db_map[team_data.magic_item_id].__dict__) if team_data.magic_item_id else None
    team_out = schemas.TeamOut(
        id=0,
        name=team_data.name,
        user_monsters=user_monster_outs,
        magic_item=magic_item_out,
    )
    result = schemas.TeamAnalysisOut(
        team=team_out,
        per_monster=per_monster_analysis,
        type_coverage=type_coverage,
        magic_item_eval=magic_item_eval,
        recommendations=recommendations,
    )
    return result