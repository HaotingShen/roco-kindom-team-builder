import pytest
import json
from sqlalchemy import create_engine, text, select
from sqlalchemy.orm import Session
from backend.models import Monster
from backend.config import DATABASE_URL

MONSTERS_JSON_PATH = "backend/data/monsters.json"
MONSTER_MOVES_JSON_PATH = "backend/data/monster_moves.json"

@pytest.fixture(scope="module")
def db_session():
    engine = create_engine(DATABASE_URL)
    with Session(engine) as session:
        yield session

def test_monster_moves_row_count(db_session):
    # Load source data
    with open(MONSTERS_JSON_PATH, encoding="utf-8") as f:
        monsters_data = json.load(f)
    with open(MONSTER_MOVES_JSON_PATH, encoding="utf-8") as f:
        monster_moves_data = json.load(f)

    # Calculate expected row count
    expected_count = 0
    for monster in monsters_data:
        moveset_key = monster.get("moveset_key")
        if not moveset_key or moveset_key not in monster_moves_data:
            continue
        moveset = monster_moves_data[moveset_key]
        all_moves = set(moveset.get("learnable_moves", [])) | set(moveset.get("move_stones", []))
        expected_count += len(all_moves)

    # Get actual count from DB
    actual_count = db_session.execute(text("SELECT COUNT(*) FROM monster_moves")).scalar_one()
    assert actual_count == expected_count, f"Expected {expected_count} rows, found {actual_count} in monster_moves table"

def test_all_monster_move_association(db_session):
    # Load source data
    with open(MONSTERS_JSON_PATH, encoding="utf-8") as f:
        monsters_data = json.load(f)
    with open(MONSTER_MOVES_JSON_PATH, encoding="utf-8") as f:
        monster_moves_data = json.load(f)

    # Build a map for monster name+form -> moveset key
    monster_map = {(m["name"], m.get("form", "default")): m.get("moveset_key") for m in monsters_data}
    # Get all monsters from DB
    monster_rows = db_session.execute(select(Monster.id, Monster.name, Monster.form)).fetchall()
    monster_rows = [(m.id, m.name, m.form or "default") for m in monster_rows]

    # Test each monster's moveset
    for monster_id, m_name, m_form in monster_rows:
        moveset_key = monster_map.get((m_name, m_form))
        if not moveset_key or moveset_key not in monster_moves_data:
            continue
        moveset = monster_moves_data[moveset_key]
        expected_moves = set(moveset.get("learnable_moves", [])) | set(moveset.get("move_stones", []))

        # Find all move_ids in DB for this monster
        move_ids_db = set([
            row[0] for row in db_session.execute(
                text("SELECT move_id FROM monster_moves WHERE monster_id = :mid"),
                {"mid": monster_id}
            ).fetchall()
        ])

        # Get all move_ids from the moves table for names in expected_moves
        move_ids_expected = set([
            row[0] for row in db_session.execute(
                text("SELECT id FROM moves WHERE name = ANY(:names)"),
                {"names": list(expected_moves)}
            ).fetchall()
        ])

        if move_ids_db != move_ids_expected:
            # Find missing and extra moves
            missing = move_ids_expected - move_ids_db
            extra = move_ids_db - move_ids_expected

            # Look up move names for readability
            missing_names = []
            extra_names = []
            if missing:
                missing_names = [
                    row[0] for row in db_session.execute(
                        text("SELECT name FROM moves WHERE id = ANY(:ids)"),
                        {"ids": list(missing)}
                    ).fetchall()
                ]
            if extra:
                extra_names = [
                    row[0] for row in db_session.execute(
                        text("SELECT name FROM moves WHERE id = ANY(:ids)"),
                        {"ids": list(extra)}
                    ).fetchall()
                ]
            pytest.fail(
                f"Monster '{m_name}' (form '{m_form}') move mismatch.\n"
                f"Missing move ids: {missing} (names: {missing_names})\n"
                f"Extra move ids: {extra} (names: {extra_names})\n"
                f"Expected: {move_ids_expected}\n"
                f"Found in DB: {move_ids_db}"
            )

def test_no_duplicates_in_monster_moves(db_session):
    duplicates = db_session.execute(text("""
        SELECT monster_id, move_id, COUNT(*)
        FROM monster_moves
        GROUP BY monster_id, move_id
        HAVING COUNT(*) > 1
    """)).fetchall()
    assert not duplicates, f"Duplicate monster-move associations found: {duplicates}"