import json
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text
from backend.models import Monster, Type, Move
from backend.config import DATABASE_URL

MONSTERS_JSON_PATH = "backend/data/monsters.json"
MONSTER_MOVES_JSON_PATH = "backend/data/monster_moves.json"

# The type order used for legacy moves
LEGACY_TYPES_ORDER = [
    "Normal", "Grass", "Fire", "Water", "Light", "Ground", "Ice", "Dragon",
    "Electric", "Poison", "Bug", "Fighting", "Flying", "Cute", "Ghost",
    "Dark", "Mechanical", "Illusion"
]

engine = create_engine(DATABASE_URL)

def load_legacy_moves():
    with open(MONSTERS_JSON_PATH, encoding="utf-8") as f:
        monsters_data = json.load(f)
    with open(MONSTER_MOVES_JSON_PATH, encoding="utf-8") as f:
        monster_moves_data = json.load(f)

    with Session(engine) as session:
        # Clear old associations (idempotent)
        session.execute(text("DELETE FROM legacy_moves"))

        # Build lookup maps
        monster_by_name_and_form = {(m.name, m.form): m.id for m in session.query(Monster).all()}
        move_map = {mv.name: mv.id for mv in session.query(Move).all()}
        type_map = {t.name: t.id for t in session.query(Type).all()}

        for monster in monsters_data:
            m_name = monster["name"]
            m_form = monster.get("form", "default")
            moveset_key = monster.get("moveset_key")
            monster_id = monster_by_name_and_form.get((m_name, m_form))
            if not moveset_key or moveset_key not in monster_moves_data:
                print(f"Warning: Monster '{m_name}' (form '{m_form}') has no valid moveset_key: {moveset_key}")
                continue
            legacy_moves = monster_moves_data[moveset_key].get("legacy_moves", [])
            if len(legacy_moves) != len(LEGACY_TYPES_ORDER):
                print(f"Warning: Legacy moves count for '{m_name}' ({m_form}) does not match LEGACY_TYPES_ORDER length!")
                continue
            for type_name, move_name in zip(LEGACY_TYPES_ORDER, legacy_moves):
                move_id = move_map.get(move_name)
                type_id = type_map.get(type_name)
                if not move_id or not type_id:
                    print(f"Warning: Move '{move_name}' or type '{type_name}' not found for monster '{m_name}' ({m_form})")
                    continue
                session.execute(
                    text("INSERT INTO legacy_moves (monster_id, type_id, move_id) VALUES (:mid, :tid, :moid) ON CONFLICT DO NOTHING"),
                    {"mid": monster_id, "tid": type_id, "moid": move_id}
                )
        session.commit()
        print("Legacy moves imported successfully!")

def main():
    load_legacy_moves()

if __name__ == "__main__":
    main()