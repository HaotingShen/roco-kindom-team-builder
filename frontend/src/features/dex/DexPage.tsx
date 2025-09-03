import { useMemo, useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PageTabs from "@/components/PageTabs";
import { endpoints } from "@/lib/api";
import { useI18n, pickName, pickDesc, pickFormName } from "@/i18n";
import type { MonsterLiteOut, MoveOut, TypeOut, MagicItemOut } from "@/types";
import useDebounce from "@/hooks/useDebounce";

/* ---------------- helpers ---------------- */

function typeIconUrl(name?: string, size: 30 | 45 | 60 = 45) {
  if (!name) return null;
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  return `/type-icons/${size}/${slug}.png`;
}

/** Image filename matches Chinese name (and Chinese form in parentheses if not default). */
function monsterImgUrlCN(m: any, size: 180 | 270 | 360 = 180) {
  const cnName = pickName(m, "zh") || m.name || String(m.id);
  const cnForm = pickFormName(m, "zh");
  const base = cnForm ? `${cnName}(${cnForm})` : cnName;
  // Use encodeURI to support Chinese and parentheses in URLs.
  return encodeURI(`/monsters/${size}/${base}.png`);
}

/** Magic-item images are named by their Chinese name. */
function magicItemImgUrl(it: any, size = 256) {
  const cnName = pickName(it, "zh") || it.name;
  return encodeURI(`/magic-items/${cnName}.png`);
}

const catIcon: Record<string, string> = {
  PHY_ATTACK: "⚔️",
  MAG_ATTACK: "🪄",
  DEFENSE: "🛡️",
  STATUS: "✨",
  ATTACK: "⚔️",
};

/* ---------------- tiny UI atoms ---------------- */

function FilterButton({
  active,
  onClick,
  children,
  className = "",
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 px-2 rounded border text-sm
                  ${active ? "bg-zinc-200" : "hover:bg-zinc-50"}
                  ${className}`}
    >
      {children}
    </button>
  );
}

function Pill({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "blue" | "amber" | "emerald" | "red";
}) {
  const styles: Record<string, string> = {
    zinc: "border-zinc-200 bg-zinc-50 text-zinc-700",
    blue: "border-blue-300 bg-blue-50 text-blue-700",
    amber: "border-amber-300 bg-amber-50 text-amber-800",
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
    red: "border-red-300 bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${styles[tone]}`}>
      {children}
    </span>
  );
}

/* ===========================================================
   Monsters tab
   =========================================================== */

function MonstersTab() {
  const { lang, t } = useI18n();
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 200);
  const [selectedTypes, setSelectedTypes] = useState<number[]>([]);
  const [filterVariant, setFilterVariant] = useState<"all" | "regional" | "leader">("all");

  const types = useQuery<TypeOut[]>({
    queryKey: ["types-all"],
    queryFn: () => endpoints.types().then((r) => r.data as TypeOut[]),
  });

  const monsters = useQuery<MonsterLiteOut[]>({
    queryKey: ["dex-monsters"],
    queryFn: () => endpoints.monsters().then((r) => (r.data?.items ?? r.data) as MonsterLiteOut[]),
  });

  const filtered = useMemo(() => {
    const list = monsters.data ?? [];
    const keywords = dq.trim().toLowerCase();

    return list.filter((m) => {
      // type filter (AND across selected types)
      if (selectedTypes.length) {
        const ids = [m.main_type?.id, m.sub_type?.id].filter(Boolean) as number[];
        const hit = selectedTypes.every((id) => ids.includes(id));
        if (!hit) return false;
      }
      // form filters
      if (filterVariant === "regional" && (!m.form || m.form.toLowerCase() === "default")) return false;
      if (filterVariant === "leader" && !m.is_leader_form) return false;

      // local search (name / type names / form / leader flag)
      if (!keywords) return true;

      const name = (pickName(m as any, lang) || m.name || "").toLowerCase();
      const form = (pickFormName(m as any, lang) || "").toLowerCase();
      const mainType = (m.main_type?.localized?.[lang] || m.main_type?.name || "").toLowerCase();
      const subType = (m.sub_type?.localized?.[lang] || m.sub_type?.name || "").toLowerCase();
      const leader = m.is_leader_form ? (lang === "zh" ? "首领" : "leader") : "";

      const hay = [name, form, mainType, subType, leader].join(" ");
      return hay.includes(keywords);
    });
  }, [monsters.data, dq, selectedTypes, filterVariant, lang]);

  const toggleType = (id: number) =>
    setSelectedTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="rounded border bg-white p-3 space-y-3">
        {/* Row 1: search */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("topbar.search")}
            className="h-9 w-[280px] rounded border px-3"
          />
        </div>

        {/* Row 2: type filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-zinc-600">{t("dex.typesLabel")}</div>
          <div className="flex flex-wrap gap-1">
            {(types.data ?? []).map((tp) => (
              <FilterButton
                key={tp.id}
                active={selectedTypes.includes(tp.id)}
                onClick={() => toggleType(tp.id)}
              >
                <span className="inline-flex items-center gap-1">
                  {typeIconUrl(tp.name) ? (
                    <img src={typeIconUrl(tp.name)!} alt="" width={16} height={16} />
                  ) : null}
                  {pickName(tp as any, lang) || tp.name}
                </span>
              </FilterButton>
            ))}
          </div>
        </div>

        {/* Row 3: form filters */}
        <div className="flex items-center gap-2">
          <div className="text-sm text-zinc-600">{t("dex.formsLabel")}</div>
          <FilterButton active={filterVariant === "all"} onClick={() => setFilterVariant("all")}>
            {t("dex.form_all")}
          </FilterButton>
          <FilterButton active={filterVariant === "regional"} onClick={() => setFilterVariant("regional")}>
            {t("dex.form_regional")}
          </FilterButton>
          <FilterButton active={filterVariant === "leader"} onClick={() => setFilterVariant("leader")}>
            {t("dex.form_leader")}
          </FilterButton>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((m) => {
          const titleName = pickName(m as any, lang) || m.name;
          const formLabel = pickFormName(m as any, lang);
          const title = [titleName, formLabel ? `(${formLabel})` : ""].filter(Boolean).join(" ");
          const src = monsterImgUrlCN(m, 180);

          return (
            <Link
              key={m.id}
              to={`/dex/monsters/${m.id}?tab=monsters`}
              className="rounded border bg-white p-3 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <div className="text-sm font-medium truncate" title={title}>{title}</div>
              <div className="mt-2 flex items-center justify-center">
                <img
                  src={src}
                  alt=""
                  width={180}
                  height={180}
                  className="h-[120px] w-[120px] object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/monsters/placeholder.png"; }}
                />
              </div>
              <div className="mt-2 flex items-center gap-1">
                {[m.main_type, m.sub_type].filter(Boolean).map((tp) => (
                  <Pill key={(tp as TypeOut).id}>
                    {typeIconUrl((tp as TypeOut).name) ? (
                      <img src={typeIconUrl((tp as TypeOut).name)!} alt="" width={14} height={14} />
                    ) : null}
                    {pickName(tp as any, lang)}
                  </Pill>
                ))}
                {m.is_leader_form ? <Pill tone="amber">{t("labels.leader")}</Pill> : null}
              </div>
            </Link>
          );
        })}
        {!filtered.length && (
          <div className="text-zinc-500">{t("dex.noResults")}</div>
        )}
      </div>
    </div>
  );
}

/* ===========================================================
   Moves tab
   =========================================================== */

type LocalMove = MoveOut & {
  move_type?: TypeOut | null;  // BE sometimes uses move_type/type
  type?: TypeOut | null;
  move_category?: string;      // ATTACK/DEFENSE/STATUS/PHY_ATTACK/MAG_ATTACK
  category?: string;
  energy_cost?: number | null;
  energy?: number | null;      // be liberal in what we accept
  power?: number | null;
  description?: string | null;
  localized?: any;
  is_move_stone?: boolean;
};

function MovesTab() {
  const { lang, t } = useI18n();
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 200);
  const [typeIds, setTypeIds] = useState<number[]>([]);
  const [cats, setCats] = useState<string[]>([]);

  const types = useQuery<TypeOut[]>({
    queryKey: ["types-all"],
    queryFn: () => endpoints.types().then((r) => r.data as TypeOut[]),
  });

  const moves = useQuery<LocalMove[]>({
    queryKey: ["dex-moves"],
    queryFn: () => endpoints.moves().then((r) => (r.data?.items ?? r.data) as LocalMove[]),
  });

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const filtered = useMemo(() => {
    const list = moves.data ?? [];
    const kw = dq.trim().toLowerCase();

    return list.filter((m) => {
      // type
      const tp = (m.move_type || m.type) as TypeOut | null;
      if (typeIds.length && (!tp || !typeIds.includes(tp.id))) return false;

      // category (normalize)
      const cat = (m.move_category || m.category || "").toUpperCase();
      if (cats.length && !cats.includes(cat)) return false;

      if (!kw) return true;

      const nm = (pickName(m as any, lang) || m.name || "").toLowerCase();
      const desc =
        (m.localized?.[lang]?.description ??
          (lang === "en" ? m.description /* en usually in base */ : m.description) ??
          "")
          .toLowerCase();

      return nm.includes(kw) || desc.includes(kw);
    });
  }, [moves.data, dq, typeIds, cats, lang]);

  const catOptions = [
    { key: "PHY_ATTACK", label: t("dex.cat_phy") },
    { key: "MAG_ATTACK", label: t("dex.cat_mag") },
    { key: "DEFENSE", label: t("dex.cat_def") },
    { key: "STATUS", label: t("dex.cat_sta") },
  ];

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="rounded border bg-white p-3 space-y-3">
        {/* Row 1: search */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("topbar.search")}
            className="h-9 w-[280px] rounded border px-3"
          />
        </div>

        {/* Row 2: type filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-zinc-600">{t("dex.skill_type")}</div>
          <div className="flex flex-wrap gap-1">
            {(types.data ?? []).map((tp) => (
              <FilterButton
                key={tp.id}
                active={typeIds.includes(tp.id)}
                onClick={() => setTypeIds((s) => toggle(s, tp.id) as number[])}
              >
                <span className="inline-flex items-center gap-1">
                  {typeIconUrl(tp.name) ? (
                    <img src={typeIconUrl(tp.name)!} alt="" width={16} height={16} />
                  ) : null}
                  {pickName(tp as any, lang) || tp.name}
                </span>
              </FilterButton>
            ))}
          </div>
        </div>

        {/* Row 3: category filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-zinc-600">{t("dex.skill_category")}</div>
          {catOptions.map((c) => (
            <FilterButton
              key={c.key}
              active={cats.includes(c.key)}
              onClick={() => setCats((s) => toggle(s, c.key) as string[])}
            >
              {c.label}
            </FilterButton>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((m) => {
          const tp = (m.move_type || m.type) as TypeOut | null;
          const cname = pickName(m as any, lang) || m.name;
          const desc = pickDesc(m as any, lang) || m.localized?.[lang]?.description || m.description || "";
          const category = (m.move_category || m.category || "").toUpperCase();
          const energy = (m.energy_cost ?? m.energy ?? null);
          const power = m.power ?? null;
          const isDef = category === "DEFENSE";
          const isSta = category === "STATUS";

          return (
            <div key={m.id} className="rounded border bg-white p-3">
              {/* Line 1 (fixed columns via CSS grid) */}
              <div className="grid grid-cols-[18px,1fr,64px,28px,60px] items-center gap-2 text-sm">
                {/* type icon */}
                <div className="flex items-center justify-center">
                  {tp?.name && typeIconUrl(tp.name) ? (
                    <img src={typeIconUrl(tp.name)!} alt="" width={16} height={16} />
                  ) : null}
                </div>

                {/* name + stone badge */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    <div className="font-medium truncate" title={cname}>{cname}</div>
                    {m.is_move_stone ? (
                      <span className="text-[10px] rounded bg-amber-100 px-1 py-0.5">{t("dex.move_stone")}</span>
                    ) : null}
                  </div>
                </div>

                {/* energy */}
                <div className="text-xs text-zinc-600 text-right tabular-nums">⭐ {energy ?? "—"}</div>

                {/* cat icon */}
                <div className="text-center">{catIcon[category] || "✨"}</div>

                {/* power or category word */}
                <div className="text-xs text-right tabular-nums">
                  {isDef ? t("dex.defense") : isSta ? t("dex.status") : (power ?? "—")}
                </div>
              </div>

              {/* Line 2: description */}
              <div className="text-xs text-zinc-600 mt-1 line-clamp-2">{desc}</div>
            </div>
          );
        })}
        {!filtered.length && (
          <div className="text-zinc-500">{t("dex.noResults")}</div>
        )}
      </div>
    </div>
  );
}

/* ===========================================================
   Magic Items tab
   =========================================================== */

function MagicItemsTab() {
  const { lang, t } = useI18n();
  const items = useQuery<MagicItemOut[]>({
    queryKey: ["dex-magic-items"],
    queryFn: () => endpoints.magicItems().then((r) => r.data as MagicItemOut[]),
  });

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {(items.data ?? []).map((it) => {
        const nm = pickName(it as any, lang) || it.name;
        const desc = pickDesc(it as any, lang) || it.description || "";
        const img = magicItemImgUrl(it);

        return (
          <div key={it.id} className="rounded border bg-white p-3 flex items-start gap-3">
            <img
              src={img}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 object-contain rounded"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/monsters/placeholder.png"; }}
            />
            <div className="min-w-0">
              <div className="font-medium truncate" title={nm}>{nm}</div>
              <div className="text-sm text-zinc-700 mt-1">{desc}</div>
            </div>
          </div>
        );
      })}
      {!items.data?.length && <div className="text-zinc-500">{t("dex.noResults")}</div>}
    </div>
  );
}

/* ===========================================================
   Game Terms tab
   =========================================================== */

type GameTerm = { id: number; key: string; name?: string; description?: string; localized?: any };

function GameTermsTab() {
  const { lang, t } = useI18n();
  const terms = useQuery<GameTerm[]>({
    queryKey: ["dex-terms"],
    queryFn: () => endpoints.gameTerms().then((r) => r.data as GameTerm[]),
  });

  return (
    <div className="rounded border bg-white p-3">
      <div className="grid gap-2">
        {(terms.data ?? []).map((g) => {
          const label = pickName(g as any, lang) || g.name || g.key;
          const desc = pickDesc(g as any, lang) || g.description || "";
          return (
            <div key={g.id} className="border rounded p-2">
              <div className="text-sm font-medium">
                {label}
                <span className="ml-2 text-xs text-zinc-500">{g.key}</span>
              </div>
              <div className="text-sm text-zinc-700">{desc}</div>
            </div>
          );
        })}
        {!terms.data?.length && <div className="text-zinc-500">{t("dex.noResults")}</div>}
      </div>
    </div>
  );
}

/* ===========================================================
   Page
   =========================================================== */

export default function DexPage() {
  const { t } = useI18n();
  return (
    <PageTabs
      tabs={[
        { key: "monsters", label: t("dex.tab_monsters"), content: (<MonstersTab />) as ReactNode },
        { key: "moves",    label: t("dex.tab_moves"),    content: (<MovesTab />) as ReactNode },
        { key: "items",    label: t("dex.tab_items"),    content: (<MagicItemsTab />) as ReactNode },
        { key: "terms",    label: t("dex.tab_terms"),    content: (<GameTermsTab />) as ReactNode },
      ]}
    />
  );
}