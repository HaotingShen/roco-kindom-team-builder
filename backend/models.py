import enum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, Table, Column, UniqueConstraint
from sqlalchemy import Enum
from sqlalchemy.dialects.postgresql import JSONB

class Base(DeclarativeBase):
    pass

# Association table for many-to-many Monster-Move relationship
monster_moves = Table(
    "monster_moves", Base.metadata,
    Column("monster_id", Integer, ForeignKey("monsters.id"), primary_key=True),
    Column("move_id", Integer, ForeignKey("moves.id"), primary_key=True)
)

class MoveCategory(enum.Enum):
    ATTACK = "Attack"
    DEFENSE = "Defense"
    STATUS = "Status"
    
class MagicEffectCode(enum.Enum):
    ENHANCE_SPELL = "enhance_spell"
    SUN_HEALING = "sun_healing"
    FLARE_BURST = "flare_burst"
    FLOW_SPELL = "flow_spell"
    EVOLUTION_POWER = "evolution_power"

class Type(Base):
    __tablename__ = "types"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    
    # Relationships
    moves = relationship("Move", back_populates="move_type")
    legacy_moves = relationship("LegacyMove", back_populates="type")
    user_monsters_as_legacy = relationship("UserMonster", back_populates="legacy_type")
    monsters_as_main_type = relationship("Monster", foreign_keys="[Monster.main_type_id]", back_populates="main_type")
    monsters_as_sub_type = relationship("Monster", foreign_keys="[Monster.sub_type_id]", back_populates="sub_type")
    monsters_as_legacy_type = relationship("Monster", foreign_keys="[Monster.default_legacy_type_id]", back_populates="default_legacy_type")
    magic_items = relationship("MagicItem", back_populates="applies_to_type")
    
class Trait(Base):
    __tablename__ = "traits"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Relationships
    monster = relationship("Monster", back_populates="trait", uselist=False)
    
class Personality(Base):
    __tablename__ = "personalities"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    # Percent modifications
    hp_mod_pct: Mapped[float] = mapped_column(Float, default=0.0)
    atk_mod_pct: Mapped[float] = mapped_column(Float, default=0.0)
    mag_atk_mod_pct: Mapped[float] = mapped_column(Float, default=0.0)
    def_mod_pct: Mapped[float] = mapped_column(Float, default=0.0)
    mag_def_mod_pct: Mapped[float] = mapped_column(Float, default=0.0)
    spd_mod_pct: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Relationships
    user_monsters = relationship("UserMonster", back_populates="personality")
    
class Move(Base):
    __tablename__ = "moves"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    move_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("types.id"))
    move_category: Mapped[MoveCategory] = mapped_column(Enum(MoveCategory, name="move_category"), nullable=False)
    power: Mapped[int] = mapped_column(Integer)
    energy_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    has_counter: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Relationships
    move_type = relationship("Type", back_populates="moves")
    legacy_for = relationship("LegacyMove", back_populates="move")
    monsters = relationship("Monster", secondary=monster_moves, back_populates="move_pool")

class LegacyMove(Base):
    __tablename__ = "legacy_moves"
    monster_id: Mapped[int] = mapped_column(Integer, ForeignKey("monsters.id"), primary_key=True)
    type_id: Mapped[int] = mapped_column(Integer, ForeignKey("types.id"), primary_key=True)
    move_id: Mapped[int] = mapped_column(Integer, ForeignKey("moves.id"), nullable=False)
    
    # Relationships
    monster = relationship("Monster", back_populates="legacy_moves")
    type = relationship("Type", back_populates="legacy_moves")
    move = relationship("Move", back_populates="legacy_for")

class Monster(Base):
    __tablename__ = "monsters"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    main_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("types.id"), nullable=False)
    sub_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("types.id"))
    default_legacy_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("types.id"), nullable=False)
    trait_id: Mapped[int] = mapped_column(Integer, ForeignKey("traits.id"), nullable=False, unique=True)
    leader_potential: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    base_hp: Mapped[int] = mapped_column(Integer, nullable=False)
    base_atk: Mapped[int] = mapped_column(Integer, nullable=False)
    base_mag_atk: Mapped[int] = mapped_column(Integer, nullable=False)
    base_def: Mapped[int] = mapped_column(Integer, nullable=False)
    base_mag_def: Mapped[int] = mapped_column(Integer, nullable=False)
    base_spd: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Relationships
    trait = relationship("Trait", back_populates="monster", uselist=False)
    move_pool = relationship("Move", secondary=monster_moves, back_populates="monsters")
    legacy_moves = relationship("LegacyMove", back_populates="monster")
    user_monsters = relationship("UserMonster", back_populates="monster")
    main_type = relationship("Type", foreign_keys=[main_type_id], back_populates="monsters_as_main_type")
    sub_type = relationship("Type", foreign_keys=[sub_type_id], back_populates="monsters_as_sub_type")
    default_legacy_type = relationship("Type", foreign_keys=[default_legacy_type_id], back_populates="monsters_as_legacy_type")

    
class Talent(Base):
    __tablename__ = "talents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    monster_instance_id: Mapped[int] = mapped_column(Integer, ForeignKey("user_monsters.id"))
    hp_boost: Mapped[int] = mapped_column(Integer, default=0)
    atk_boost: Mapped[int] = mapped_column(Integer, default=0)
    mag_atk_boost: Mapped[int] = mapped_column(Integer, default=0)
    def_boost: Mapped[int] = mapped_column(Integer, default=0)
    mag_def_boost: Mapped[int] = mapped_column(Integer, default=0)
    spd_boost: Mapped[int] = mapped_column(Integer, default=0)
    
    # Relationships
    user_monster = relationship("UserMonster", back_populates="talent", uselist=False)
   
# Represents a user's input monster (with personality, custom legacy type, talents) 
class UserMonster(Base):
    __tablename__ = "user_monsters"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    monster_id: Mapped[int] = mapped_column(Integer, ForeignKey("monsters.id"), nullable=False)
    personality_id: Mapped[int] = mapped_column(Integer, ForeignKey("personalities.id"), nullable=False)
    legacy_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("types.id"), nullable=False)
    has_leader_tag: Mapped[bool] = mapped_column(Boolean, default=False)
    # Selected 4 moves for each user monster
    move1_id: Mapped[int] = mapped_column(Integer, ForeignKey("moves.id"))
    move2_id: Mapped[int] = mapped_column(Integer, ForeignKey("moves.id"))
    move3_id: Mapped[int] = mapped_column(Integer, ForeignKey("moves.id"))
    move4_id: Mapped[int] = mapped_column(Integer, ForeignKey("moves.id"))
    # Relationships
    monster = relationship("Monster", back_populates="user_monsters")
    personality = relationship("Personality", back_populates="user_monsters")
    legacy_type = relationship("Type", back_populates="user_monsters_as_legacy")
    talent = relationship("Talent", back_populates="user_monster", uselist=False)
    move1 = relationship("Move", foreign_keys=[move1_id])
    move2 = relationship("Move", foreign_keys=[move2_id])
    move3 = relationship("Move", foreign_keys=[move3_id])
    move4 = relationship("Move", foreign_keys=[move4_id])

class MagicItem(Base):
    __tablename__ = "magic_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    effect_code: Mapped[MagicEffectCode] = mapped_column(Enum(MagicEffectCode, name="magic_effect_code"), nullable=False)
    applies_to_type_id: Mapped[int] = mapped_column(Integer, ForeignKey("types.id"), nullable=True)
    applies_to_leader_tag: Mapped[bool] = mapped_column(Boolean, default=False)
    # JSON for extra logic
    effect_parameters: Mapped[dict] = mapped_column(JSONB, nullable=True)

    # Relationships
    applies_to_type = relationship("Type", back_populates="magic_items")