from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, sessionmaker, joinedload
from sqlalchemy import create_engine, or_
from config import DATABASE_URL, OPENAI_API_KEY, GEMINI_API_KEY
from typing import Optional, List
import models, schemas
import re
import openai
import google.generativeai as genai
import asyncio
import json
import time

openai.api_key = OPENAI_API_KEY
genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development, restrict for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# === TOP-LEVEL HELPER FUNCTIONS ===
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
        if cat in [models.MoveCategory.PHY_ATTACK, models.MoveCategory.MAG_ATTACK]:
            has_attack_counter_status = True
        elif cat == models.MoveCategory.DEFENSE:
            has_defense_counter_attack = True
        elif cat == models.MoveCategory.STATUS:
            has_status_counter_defense = True
        
    return schemas.CounterCoverage(
        has_attack_counter_status=has_attack_counter_status,
        has_defense_counter_attack=has_defense_counter_attack,
        has_status_counter_defense=has_status_counter_defense,
        total_counter_moves=len(counter_move_ids),
        counter_move_ids=counter_move_ids
    )
    
# Count and record defense/status moves
def compute_defense_status_move(moves):
    defense_status_move_ids = []
    for m in moves:
        if m.move_category in [models.MoveCategory.DEFENSE, models.MoveCategory.STATUS]:
            defense_status_move_ids.append(m.id)
    return schemas.DefenseStatusMove(
        defense_status_move_count=len(defense_status_move_ids),
        defense_status_move=defense_status_move_ids,
    )
    
# Trait Synergy LLM Analysis
def build_trait_synergy_prompt(monster, trait, selected_moves, preferred_attack_style, game_terms):
    move_lines = "\n".join(
        f"- {m.name}: {m.description}" for m in selected_moves
    )
    glossary = "\n".join(
        f"- {gt.key}: {gt.description}" for gt in game_terms
    )
    prompt = f"""You are an expert game strategist.
Monster: {monster.name}
Trait: {trait.name} — {trait.description}
Preferred attack style: {preferred_attack_style}
Selected moves:
{move_lines}

Game Terms Glossary:
{glossary}

Instructions:
1. Identify which moves are especially synergistic with the trait, and which might conflict.
2. Give recommendations for improving move selection in general (e.g. suggest to favor moves of a certain type or avoid certain status effects, do NOT name or suggest specific move swaps).
3. Output as JSON in the format:
{{
"synergy_moves": [list of move names],
"recommendation": [list of suggestions as strings]
}}
"""
    return prompt

# Compute team-level analysis
def compute_type_coverage(user_monsters, move_db_map, monster_db_map, type_db_map):
    all_type_ids = set(type_db_map.keys())

    # Step 1: Gather all move types for offense
    team_move_types = set()
    for um in user_monsters:
        for move_id in [um.move1_id, um.move2_id, um.move3_id, um.move4_id]:
            move = move_db_map[move_id]
            if move.move_type_id:
                team_move_types.add(move.move_type_id)

    # Step 2: Offensive coverage
    effective_against_types = set()
    for move_type_id in team_move_types:
        move_type = type_db_map[move_type_id]
        effective_against_types.update([t.id for t in move_type.effective_against])

    weak_against_types = list(all_type_ids - effective_against_types)

    # Step 3: Defensive weakness (team_weak_to)
    team_weak_to = set()
    all_types = list(type_db_map.values())
    for um in user_monsters:
        base_monster = monster_db_map[um.monster_id]
        main_type = type_db_map[base_monster.main_type_id]
        sub_type = type_db_map[base_monster.sub_type_id] if base_monster.sub_type_id else None

        for attacking_type in all_types:
            # Determine effectiveness against main and sub
            weak_main = attacking_type in main_type.vulnerable_to
            weak_sub = sub_type and attacking_type in sub_type.vulnerable_to

            resist_main = attacking_type in main_type.resistant_to
            resist_sub = sub_type and attacking_type in sub_type.resistant_to

            # Neutralization logic:
            # - double weak = still weak
            # - weak+resist = neutral
            # - only one weak, other neutral = weak
            if weak_main and weak_sub:
                team_weak_to.add(attacking_type.id)
            elif (weak_main and not resist_sub and not weak_sub) or (weak_sub and not resist_main and not weak_main):
                team_weak_to.add(attacking_type.id)
            # If one is weak and other is resist, do NOT add (neutralized)

    return {
        "effective_against_types": sorted(effective_against_types),
        "weak_against_types": sorted(weak_against_types),
        "team_weak_to": sorted(team_weak_to),
    }
    
def compute_magic_item_eval(magic_item, user_monster_outs, type_db_map):
    valid_targets = []

    if not magic_item:
        return None

    # Dynamic type IDs by name
    TYPE_NAME_TO_ID = {t.name.lower(): t.id for t in type_db_map.values()}
    GRASS_TYPE_ID = TYPE_NAME_TO_ID.get("grass")
    FIRE_TYPE_ID = TYPE_NAME_TO_ID.get("fire")
    WATER_TYPE_ID = TYPE_NAME_TO_ID.get("water")
    LEADER_TYPE_ID = TYPE_NAME_TO_ID.get("leader")

    effect_code = getattr(magic_item, "effect_code", None)

    for user_monster in user_monster_outs:
        m = user_monster.monster  # MonsterLiteOut
        legacy_type_id = getattr(user_monster.legacy_type, "id", None)
        main_type_id = getattr(m.main_type, "id", None)
        sub_type_id = getattr(m.sub_type, "id", None)

        # Enhancement Spell: any monster
        if effect_code == models.MagicEffectCode.ENHANCE_SPELL:
            valid_targets.append(user_monster.id)

        # Sun Healing: grass main/sub/legacy
        elif effect_code == models.MagicEffectCode.SUN_HEALING:
            if ((main_type_id == GRASS_TYPE_ID) or
                (sub_type_id == GRASS_TYPE_ID) or
                (legacy_type_id == GRASS_TYPE_ID)):
                valid_targets.append(user_monster.id)

        # Flare Burst: fire main/sub/legacy
        elif effect_code == models.MagicEffectCode.FLARE_BURST:
            if ((main_type_id == FIRE_TYPE_ID) or
                (sub_type_id == FIRE_TYPE_ID) or
                (legacy_type_id == FIRE_TYPE_ID)):
                valid_targets.append(user_monster.id)

        # Flow Spell: water main/sub/legacy
        elif effect_code == models.MagicEffectCode.FLOW_SPELL:
            if ((main_type_id == WATER_TYPE_ID) or
                (sub_type_id == WATER_TYPE_ID) or
                (legacy_type_id == WATER_TYPE_ID)):
                valid_targets.append(user_monster.id)

        # Evolution Power: only if leader_potential and legacy type is Leader
        elif effect_code == models.MagicEffectCode.EVOLUTION_POWER:
            if getattr(m, "leader_potential", False) and (legacy_type_id == LEADER_TYPE_ID):
                valid_targets.append(user_monster.id)

    # More logic can be added here for other analysis aspects
    return {
        "chosen_item": magic_item,
        "valid_targets": valid_targets,
        "best_target_monster_id": None,
        "reasoning": None,
    }

# Generate recommendations based on analyses
def generate_recommendations(per_monster_analysis, type_coverage, magic_item_eval, move_db_map, type_db_map):
    recommendations = []

    # 1. Type Coverage - Offense
    if type_coverage["weak_against_types"]:
        names = [type_db_map[t].name for t in type_coverage["weak_against_types"]]
        recommendations.append(
            f"Your team cannot hit these types super-effectively: {', '.join(names)}. Consider adding moves for coverage."
        )

    # 2. Type Coverage - Team Weaknesses
    if type_coverage["team_weak_to"]:
        names = [type_db_map[t].name for t in type_coverage["team_weak_to"]]
        recommendations.append(
            f"Your team is especially vulnerable to: {', '.join(names)}. Consider defensive options or resistances."
        )

    # 3. Magic Item Usage
    if magic_item_eval["valid_targets"] == []:
        recommendations.append("Your selected magic item cannot be used by any monster in your current team!")
    elif len(magic_item_eval["valid_targets"]) == 1:
        idx = magic_item_eval["valid_targets"][0]
        name = next(
            (analysis.user_monster.monster.name for analysis in per_monster_analysis if analysis.user_monster.id == idx),
            "Unknown"
        )
        recommendations.append(f"Only {name} can use the selected magic item.")

    # 4. Monster Redundancy & Uniqueness
    main_types = [analysis.user_monster.monster.main_type.id for analysis in per_monster_analysis]
    if len(set(main_types)) <= 2:
        names = [type_db_map[t].name for t in set(main_types)]
        recommendations.append(
            f"Most of your monsters share the same main types: {', '.join(names)}. This makes you more vulnerable to certain counters."
        )

    # 5. Monster Analysis - Per Monster
    for analysis in per_monster_analysis:
        mname = analysis.user_monster.monster.name

        # Energy management
        if analysis.energy_profile.avg_energy_cost > 4:
            recommendations.append(f"{mname}'s moves have high average energy cost. Consider lower-cost or energy-restoring moves.")

        # Counter coverage
        if analysis.counter_coverage.total_counter_moves == 0:
            recommendations.append(f"{mname} has no counter-effect moves selected. This can make it vulnerable to prediction-based plays.")
            
        # Defense/Status moves
        if analysis.defense_status_move.defense_status_move_count < 2:
            recommendations.append(f"{mname} has fewer than 2 Defense or Status moves. Consider adding more for survivability and utility.")
            
        # Trait synergy moves
        for synergy in analysis.trait_synergies:
            if synergy.synergy_moves:
                moves = [move_db_map[mid].name for mid in synergy.synergy_moves]
                recommendations.append(f"{mname}'s trait works well with these moves: {', '.join(moves)}.")

    # 6. Role diversity (example: all physical attackers)
    attack_styles = [getattr(analysis.user_monster.monster, "preferred_attack_style", None) for analysis in per_monster_analysis]
    if len(set(attack_styles)) == 1:
        style = attack_styles[0]
        recommendations.append(f"All your monsters are {style}-style attackers. This may make you predictable and easy to counter.")

    # For debugging: include a summary of key findings
    if not recommendations:
        recommendations.append("No major weaknesses or coverage gaps detected. Well-built team!")

    return recommendations


# === GET Endpoints ===

@app.get("/")
def read_root():
    return {"message": "Welcome to roco kindom!"}

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


# -------- POST Endpoints --------

@app.post("/teams/", response_model=schemas.TeamOut)
def create_team(team: schemas.TeamCreate, db: Session = Depends(get_db)):
    # Persist the team and its monsters to DB
    db_team = models.Team(name=team.name, magic_item_id=team.magic_item_id)
    db.add(db_team)
    db.flush()

    user_monsters_out = []   # For future expand reference
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

# -------- Analyze Team (Inline) --------

@app.post("/team/analyze/", response_model=schemas.TeamAnalysisOut)
async def analyze_team(req: schemas.TeamAnalyzeInlineRequest, db: Session = Depends(get_db)):
    start_time = time.time()
    
    team_data = req.team  # This is TeamCreate (with 6 UserMonsterCreate)
    
    # --- Helper: Call LLM and Parse Result ---
    async def call_llm(prompt):
        try:
            model = genai.GenerativeModel('gemini-2.5-flash')
            generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
            response = await model.generate_content_async(prompt, generation_config=generation_config)
            # Robust text extraction
            text = ""
            try:
                text = response.candidates[0].content.parts[0].text
            except Exception:
                text = getattr(response, "text", "")
            result = json.loads(text)
        except Exception as e:
            print("LLM error:", e)
            result = {"synergy_moves": [], "recommendation": ["Error generating analysis."]}
        return result
    
    # === EFFICIENT DATA LOADING ===
    print("Start loading data for analysis...")
    monster_ids_to_load = {um.monster_id for um in team_data.user_monsters}
    monster_db_map = {m.id: m for m in db.query(models.Monster).filter(models.Monster.id.in_(monster_ids_to_load)).all()}
    print("Loaded monsters:", len(monster_db_map))
    
    print("Loading moves...")
    move_ids_to_load = set()
    for um in team_data.user_monsters:
        move_ids_to_load.update([um.move1_id, um.move2_id, um.move3_id, um.move4_id])
    move_db_map = {m.id: m for m in db.query(models.Move).filter(models.Move.id.in_(move_ids_to_load)).all()}
    print("Loaded moves:", len(move_db_map))
    
    print("Loading traits...")
    trait_ids_to_load = {m.trait_id for m in monster_db_map.values()}
    trait_db_map = {t.id: t for t in db.query(models.Trait).filter(models.Trait.id.in_(trait_ids_to_load)).all()}
    print("Loaded traits:", len(trait_db_map))

    print("Loading types...")
    type_db_map = {
        t.id: t
        for t in db.query(models.Type)
        .options(
            joinedload(models.Type.effective_against),
            joinedload(models.Type.weak_against),
        )
        .all()
    }
    print("Loaded types:", len(type_db_map))
    
    print("Loading personalities...")
    personality_ids_to_load = {um.personality_id for um in team_data.user_monsters}
    personality_db_map = {p.id: p for p in db.query(models.Personality).filter(models.Personality.id.in_(personality_ids_to_load)).all()}
    print("Loaded personalities:", len(personality_db_map))

    print("Loading magic item and game terms...")
    magic_item = db.query(models.MagicItem).filter(models.MagicItem.id == team_data.magic_item_id).first() if team_data.magic_item_id else None
    game_terms = db.query(models.GameTerm).all()
    print("Loaded game terms:", len(game_terms))
    
    print("Finish loading data for analysis!")

    # === CONCURRENT LLM ANALYSIS ===
    print("Start creating prompt for LLM analysis...")
    llm_tasks = []
    for um in team_data.user_monsters:
        base_monster = monster_db_map[um.monster_id]
        trait = trait_db_map[base_monster.trait_id]
        selected_moves = [move_db_map[um.move1_id], move_db_map[um.move2_id], move_db_map[um.move3_id], move_db_map[um.move4_id]]
        preferred_attack_style = getattr(base_monster, "preferred_attack_style", "Both")
        prompt = build_trait_synergy_prompt(base_monster, trait, selected_moves, preferred_attack_style, game_terms)
        llm_tasks.append(call_llm(prompt))
    # llm_results = await asyncio.gather(*llm_tasks)
    llm_results = []
    for task in llm_tasks:
        llm_results.append(await task)
        
    print("Finish creating prompt for LLM analysis!")

    # Build UserMonsterOuts and compute per-monster analysis
    print("Start per-monster analysis...")
    user_monster_outs = []
    per_monster_analysis = []
    for i, um in enumerate(team_data.user_monsters):
        base_monster = monster_db_map[um.monster_id]
        personality = personality_db_map[um.personality_id]
        legacy_type = type_db_map[um.legacy_type_id]
        trait = trait_db_map[base_monster.trait_id]
        move1 = move_db_map[um.move1_id]
        move2 = move_db_map[um.move2_id]
        move3 = move_db_map[um.move3_id]
        move4 = move_db_map[um.move4_id]
        selected_moves = [move1, move2, move3, move4]
        talent = um.talent
        llm_result = llm_results[i]
        
        # Map move names to ids for schema output
        move_name_to_id = {m.name: m.id for m in selected_moves}
        synergy_moves = [move_name_to_id[name] for name in llm_result.get("synergy_moves", []) if name in move_name_to_id]

        trait_synergy_finding = schemas.TraitSynergyFinding(
            monster_id=base_monster.id,
            trait=schemas.TraitOut.model_validate(trait),
            synergy_moves=synergy_moves,
            recommendation=llm_result.get("recommendation", [])
        )
            
        # Call the top-level helper functions
        effective_stats = compute_effective_stats(base_monster, personality, talent)
        energy_profile = compute_energy_profile(selected_moves)
        counter_coverage = compute_counter_coverage(selected_moves)
        defense_status_move = compute_defense_status_move(selected_moves)

        # Build UserMonsterOut
        def to_monster_lite_out(monster, type_db_map):
            return schemas.MonsterLiteOut(
                id=monster.id,
                name=monster.name,
                form=monster.form,
                main_type=schemas.TypeOut(**type_db_map[monster.main_type_id].__dict__),
                sub_type=schemas.TypeOut(**type_db_map[monster.sub_type_id].__dict__) if monster.sub_type_id else None,
                is_leader_form=monster.is_leader_form,
                localized=monster.localized
            )

        user_monster_out = schemas.UserMonsterOut(
            id=i,
            monster=to_monster_lite_out(base_monster, type_db_map),
            personality=schemas.PersonalityOut(**personality.__dict__),
            legacy_type=schemas.TypeOut(**legacy_type.__dict__),
            move1=schemas.MoveOut(**move1.__dict__),
            move2=schemas.MoveOut(**move2.__dict__),
            move3=schemas.MoveOut(**move3.__dict__),
            move4=schemas.MoveOut(**move4.__dict__),
            talent=schemas.TalentOut(id=i, **talent.model_dump()),
        )
        
        user_monster_outs.append(user_monster_out)

        # Build MonsterAnalysisOut
        monster_analysis = schemas.MonsterAnalysisOut(
            user_monster=user_monster_out,
            effective_stats=effective_stats,
            energy_profile=energy_profile,
            counter_coverage=counter_coverage,
            defense_status_move=defense_status_move,
            trait_synergies=[trait_synergy_finding]
        )
        per_monster_analysis.append(monster_analysis)
        
    print("Finish per-monster analysis!")

    # Call the top-level helper functions
    print("Start team-level analysis...")
    type_coverage = compute_type_coverage(team_data.user_monsters, move_db_map, monster_db_map, type_db_map)
    magic_item_eval = compute_magic_item_eval(magic_item, user_monster_outs, type_db_map)
    recommendations = generate_recommendations(per_monster_analysis, type_coverage, magic_item_eval, move_db_map, type_db_map)

    # Build TeamOut and TeamAnalysisOut (final response)
    magic_item_out = schemas.MagicItemOut(**magic_item.__dict__) if magic_item else None
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
    
    print("Finish team-level analysis!")
    elapsed = time.time() - start_time
    print(f"POST /team/analyze took {elapsed:.3f} seconds")
    return result