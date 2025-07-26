# Roco Kindom Team Builder App
A team-building tool built with React, TypeScript, FastAPI, PostgreSQL, and Docker for mobile game Roco Kingdom: World


## Features

* **Full database schema** for monsters, moves, types, traits, personalities, items, and all associations.
* **Bulk import scripts** to load data from JSON files into a normalized PostgreSQL database.
* **Idempotent ETL scripts** for safe re-run after updates without creating duplicates.
* **Rich association mapping** (e.g., monster-moves, legacy moves per type, type effectiveness, etc.).
* **Unit tests** to verify integrity and correctness of imported data.


## Tech Stack

* **Python 3.10+**
* **SQLAlchemy 2.x** ORM
* **PostgreSQL 14+**
* **Alembic** for database migrations
* **pytest** for unit and integration tests
* **FastAPI** for API
* **WSL/Ubuntu** and VSCode for development


## Database Schema Highlights

* **Monsters**: All forms, evolutions, types, and stats; supports multiple forms per species.
* **Moves**: Learnable moves, move stones, move types, categories, and system moves.
* **Types**: With full type effectiveness and resistance mapping (many-to-many).
* **Traits**: Affecting battle mechanics, with localized descriptions.
* **Personalities**: Affecting monster's base stats, with parameters.
* **Magic Items**: Linked to specific types or monsters, with parameters.
* **Associations**:

  * `monster_moves`: Many-to-many for monsters and their available moves.
  * `legacy_moves`: Per-monster, per-type "signature" moves.
  * Type effectiveness: `type_effective_against`, `type_weak_against` tables.