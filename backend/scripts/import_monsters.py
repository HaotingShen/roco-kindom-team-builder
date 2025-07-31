import json
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from backend.models import Monster, MonsterSpecies, Type, Trait
from backend.config import DATABASE_URL
from sqlalchemy import create_engine, text

MONSTERS_JSON_PATH = "backend/data/monsters.json"

engine = create_engine(DATABASE_URL)

def load_monsters_two_pass():
    with open(MONSTERS_JSON_PATH, encoding="utf-8") as f:
        monsters_data = json.load(f)

    with Session(engine) as session:
        # Build all FK maps
        species_map = {s.name: s.id for s in session.query(MonsterSpecies).all()}
        type_map = {t.name: t.id for t in session.query(Type).all()}
        trait_map = {tr.name: tr.id for tr in session.query(Trait).all()}

        # FIRST PASS: Insert all monsters with evolves_from_id=None
        for item in monsters_data:
            stmt = insert(Monster).values(
                name=item["name"],
                evolves_from_id=None,
                species_id=species_map[item["species"]],
                form=item.get("form", "default"),
                main_type_id=type_map[item["main_type"]],
                sub_type_id=type_map.get(item["sub_type"]),
                default_legacy_type_id=type_map[item["default_legacy_type"]],
                trait_id=trait_map[item["trait"]],
                leader_potential=item.get("leader_potential", False),
                is_leader_form=item.get("is_leader_form", False),
                base_hp=item["base_hp"],
                base_phy_atk=item["base_phy_atk"],
                base_mag_atk=item["base_mag_atk"],
                base_phy_def=item["base_phy_def"],
                base_mag_def=item["base_mag_def"],
                base_spd=item["base_spd"],
                localized=item["localized"]
            ).on_conflict_do_update(
                index_elements=["name", "form"],
                set_={
                    "species_id": species_map[item["species"]],
                    "form": item.get("form", "default"),
                    "main_type_id": type_map[item["main_type"]],
                    "sub_type_id": type_map.get(item["sub_type"]),
                    "default_legacy_type_id": type_map[item["default_legacy_type"]],
                    "trait_id": trait_map[item["trait"]],
                    "leader_potential": item.get("leader_potential", False),
                    "is_leader_form": item.get("is_leader_form", False),
                    "base_hp": item["base_hp"],
                    "base_phy_atk": item["base_phy_atk"],
                    "base_mag_atk": item["base_mag_atk"],
                    "base_phy_def": item["base_phy_def"],
                    "base_mag_def": item["base_mag_def"],
                    "base_spd": item["base_spd"],
                    "localized": item["localized"]
                }
            )
            session.execute(stmt)
        session.commit()

        # Build monster_map by (name, form) now that all monsters exist
        monster_by_name_and_form = {(m.name, m.form): m.id for m in session.query(Monster).all()}

        # SECOND PASS: Update evolves_from_id for each monster by (name, form)
        for item in monsters_data:
            evolves_from = item.get("evolves_from")
            this_form = item.get("form", "default")
            if evolves_from:
                # Try parent's default form first
                parent_id = monster_by_name_and_form.get((evolves_from, "default"))
                if parent_id is None:
                    # Fallback: try matching this form
                    parent_id = monster_by_name_and_form.get((evolves_from, this_form))
                if parent_id is None:
                    print(f"Warning: evolves_from '{evolves_from}' (form 'default' or '{this_form}') not found for monster '{item['name']}' with form '{this_form}'")
                    continue
                session.execute(
                    text("UPDATE monsters SET evolves_from_id = :eid WHERE name = :name AND form = :form"),
                    {"eid": parent_id, "name": item["name"], "form": this_form}
                )
        session.commit()
        print("Monsters imported successfully!")

def main():
    load_monsters_two_pass()

if __name__ == "__main__":
    main()