# Roco Kingdom Team Builder App

A full-stack team-building tool for the mobile game **Roco Kingdom: World**, designed to help players create, analyze, and optimize PvP teams.  

The backend is built with **FastAPI, PostgreSQL, SQLAlchemy, and Alembic**, and the frontend uses **React and TypeScript**. The system powers detailed team creation, editing, and analysis with effective stat calculations, type coverage checks, magic item evaluation, and **LLM-driven** trait–move synergy recommendations.


## **Features (Backend)**

- **Comprehensive PostgreSQL schema** for all game entities:
  - Monsters (forms, evolutions, dual types, leader potential)
  - Moves (categories, type matchups, counter effects, energy cost)
  - Types (full many-to-many mappings for strengths, weaknesses, resistances)
  - Traits, Personalities, Magic Items, Game Terms
  - Association tables for monster move pools, legacy-type moves, and type relationships

- **Optimized ETL pipeline**:
  - Bulk JSON import scripts with **idempotent inserts** to avoid duplicates
  - Handles complex relationships (e.g., legacy moves linked to both monster and type)

- **Battle simulation data logic**:
  - Personality-based stat calculations with rounding rules
  - Energy profile analysis (average cost, zero-cost, energy restore detection)
  - Counter coverage detection for attack/defense/status categories
  - Defensive utility move counts

- **LLM-powered trait synergy analysis**:
  - Dynamically generates prompts including monster stats, trait description, and selected moves
  - Returns **synergy move lists** and tailored recommendations (2 move-usage strategies, 1 general move selection tip)
  - Async batching for efficiency using `asyncio.gather`

- **REST API with full CRUD for teams**:
  - Create, read, update (with nested monster/talent replacement), delete teams
  - Inline analysis endpoint for unpersisted teams
  - Analysis-by-ID endpoint for saved teams

- **Detailed team-level evaluation**:
  - Offensive type coverage and weaknesses
  - Team-wide defensive vulnerability analysis
  - Role diversity check based on preferred attack styles
  - Magic item compatibility evaluation
  - Summary recommendations combining algorithmic checks and LLM insights


## **Tech Stack**

**Backend**
- Python 3.10+
- FastAPI
- SQLAlchemy 2.x ORM
- Alembic (migrations)
- PostgreSQL 14+
- Psycopg2 (Postgres driver)
- Google Generative AI SDK

**Frontend**
- React 18
- TypeScript
- Tailwind CSS
- Axios (API calls)

**Dev Environment**
- WSL/Ubuntu
- VSCode
- Docker & docker-compose


## **Database Schema Highlights**

| Table           | Purpose                                                              |
| --------------- | -------------------------------------------------------------------- |
| `monsters`      | All monster forms, stats, type relationships, preferred attack style |
| `moves`         | Move pool, type, category, energy cost, counter flags                |
| `types`         | Type chart data with many-to-many relations for effectiveness        |
| `traits`        | Passive abilities affecting battle mechanics                         |
| `personalities` | Stat modifiers per monster                                           |
| `magic_items`   | Usable items with conditional effects                                |
| `user_monsters` | User’s chosen monsters in a team, linked to moves and talents        |
| `talents`       | Stat boosts applied to a user’s monster                              |
| `teams`         | Collection of `user_monsters` with optional magic item               |

---

## **API Highlights**

| Endpoint               | Method           | Purpose                                   |
| ---------------------- | ---------------- | ----------------------------------------- |
| `/monsters/`           | GET              | List/filter monsters                      |
| `/monsters/{id}`       | GET              | Monster details with move pool            |
| `/moves/`              | GET              | List/filter moves                         |
| `/moves/{id}`          | GET              | Move details                              |
| `/teams/`              | POST             | Create team                               |
| `/teams/{id}`          | GET              | Fetch saved team                          |
| `/teams/{id}`          | PUT              | Update team (replace/add/remove monsters) |
| `/teams/{id}`          | DELETE           | Delete team                               |
| `/team/analyze/`       | POST             | Analyze inline team                       |
| `/team/analyze_by_id/` | POST             | Analyze saved team                        |