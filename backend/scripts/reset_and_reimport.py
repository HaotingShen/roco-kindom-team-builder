from sqlalchemy import create_engine, inspect, text
from backend.models import Base
from backend.config import DATABASE_URL
from backend.scripts import import_types, import_traits, import_personalities, import_monster_species, import_magic_items, import_game_terms, import_moves, import_monsters, import_monster_moves, import_legacy_moves

engine = create_engine(DATABASE_URL)

def drop_all_except(engine, keep_tables):
    insp = inspect(engine)
    all_tables = insp.get_table_names()
    to_drop = [t for t in all_tables if t not in keep_tables]
    with engine.connect() as conn:
        for table in to_drop:
            conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE;'))
        conn.commit()

def recreate_schema():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    keep_tables = ['user_monsters', 'teams']  # Tables need to keep
    drop_all_except(engine, keep_tables)
    recreate_schema()

    # Run import scripts in order
    import_game_terms.main()
    import_types.main()
    import_traits.main()
    import_personalities.main()
    import_monster_species.main()
    import_magic_items.main()
    import_moves.main()
    import_monsters.main()
    import_monster_moves.main()
    import_legacy_moves.main()
    print("Database has been reset and core data imported!")