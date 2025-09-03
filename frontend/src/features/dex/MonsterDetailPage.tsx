import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import { useI18n, pickName, pickDesc, pickFormName } from "@/i18n";
import type { TypeOut, MoveOut } from "@/types";

/* ---------- helpers ---------- */

function typeIconUrl(name?: string, size: 30 | 45 | 60 = 45) {
  if (!name) return null;
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  return `/type-icons/${size}/${slug}.png`;
}

function monsterImgUrlCN(m: any, size: 180 | 270 | 360 = 270) {
  const cnName = pickName(m, "zh") || m.name || String(m.id);
  const cnForm = pickFormName(m, "zh");
  const base = cnForm ? `${cnName}(${cnForm})` : cnName;
  return encodeURI(`/monsters/${size}/${base}.png`);
}

const catIcon: Record<string, string> = {
  PHY_ATTACK: "⚔️",
  MAG_ATTACK: "🪄",
  DEFENSE: "🛡️",
  STATUS: "✨",
  ATTACK: "⚔️",
};

const statKeys = ["hp","phy_atk","mag_atk","phy_def","mag_def","spd"] as const;
type StatKey = typeof statKeys[number];

function extractStats(m: any): Partial<Record<StatKey, number>> {
  const candidates = [m.base_stats, m.effective_stats, m.stats, m.monster_stats];
  for (const c of candidates) {
    if (c && typeof c === "object") {
      return {
        hp: c.hp ?? 0,
        phy_atk: c.phy_atk ?? 0,
        mag_atk: c.mag_atk ?? 0,
        phy_def: c.phy_def ?? 0,
        mag_def: c.mag_def ?? 0,
        spd: c.spd ?? 0,
      };
    }
  }
  return { hp:0, phy_atk:0, mag_atk:0, phy_def:0, mag_def:0, spd:0 };
}

/* If legacy moves come as ids, fetch details via /moves?ids=1,2,3  */
function useMoveObjects(list: any[] | undefined) {
  const ids = Array.isArray(list) ? list.map((x) => (typeof x === "number" ? x : x?.id)).filter(Boolean) : [];
  const needFetch = Array.isArray(list) && list.length > 0 && typeof list[0] === "number";
  const q = useQuery({
    queryKey: ["moves-by-ids", ids.join(",")],
    queryFn: () => endpoints.moves({ ids: ids.join(",") }).then((r) => r.data?.items ?? r.data),
    enabled: needFetch && ids.length > 0,
  });
  if (needFetch) return q.data ?? [];
  return list ?? [];
}

export default function MonsterDetailPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const fromTab = sp.get("tab") || "monsters";
  const which = sp.get("moves") === "legacy" ? "legacy" : "pool";
  const { lang, t } = useI18n();

  const q = useQuery({
    queryKey: ["monster", id],
    queryFn: () => endpoints.monsterById(id!).then((r) => r.data),
    enabled: !!id,
  });

  if (q.isLoading) return <div>{t("common.loading")}</div>;
  if (!q.data) return <div>Not found.</div>;

  const m = q.data;
  const nm = pickName(m as any, lang) || m.name;
  const fm = pickFormName(m as any, lang);
  const title = [nm, fm ? `(${fm})` : ""].filter(Boolean).join(" ");

  const trait = m.trait || m.ability || null;
  const evo = m.evolution_chain || []; // array of ids or {id, name, form}
  const baseStats = extractStats(m);
  const total = statKeys.reduce((s, k) => s + (baseStats[k] ?? 0), 0);

  const movePool = useMoveObjects(m.move_pool);
  const legacyMoves = useMoveObjects(m.legacy_moves);

  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <Link
          to={`/dex?tab=${fromTab}`}
          className="inline-flex items-center gap-1 text-sm rounded border px-2 py-1 hover:bg-zinc-50"
        >
          <span aria-hidden className="text-lg leading-none">←</span>
          {t("dex.backToDex") || "Back to Dex"}
        </Link>
      </div>

      {/* Top info — more visual & attractive */}
      <section className="rounded border bg-white p-0 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left: name, types, image on gradient */}
          <div className="p-4 bg-gradient-to-b from-zinc-50 to-white">
            <div className="text-lg font-semibold">{title}</div>
            <div className="mt-1 flex items-center gap-1">
              {[m.main_type, m.sub_type].filter(Boolean).map((tp: TypeOut) => (
                <span key={tp.id} className="inline-flex items-center gap-1 rounded bg-zinc-100 text-xs px-2 py-0.5">
                  {typeIconUrl(tp.name) ? <img src={typeIconUrl(tp.name)!} alt="" width={18} height={18} /> : null}
                  {pickName(tp as any, lang)}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center">
              <img
                src={monsterImgUrlCN(m, 270)}
                alt=""
                width={270}
                height={270}
                className="h-[200px] w-[200px] object-contain drop-shadow-sm"
                onError={(e)=>{(e.currentTarget as HTMLImageElement).src="/monsters/placeholder.png"}}
              />
            </div>
          </div>

          {/* Right: stat bars */}
          <div className="p-4">
            <div className="font-medium mb-1">{t("dex.totalBase")}: {total}</div>
            <div className="space-y-1">
              {statKeys.map((k) => {
                const labels: Record<StatKey, string> = {
                  hp: t("labels.hp"),
                  phy_atk: t("labels.phyAtk"),
                  mag_atk: t("labels.magAtk"),
                  phy_def: t("labels.phyDef"),
                  mag_def: t("labels.magDef"),
                  spd: t("labels.spd"),
                };
                const val = baseStats[k] ?? 0;
                const pct = Math.min(100, Math.round((val / 300) * 100));
                return (
                  <div key={k} className="flex items-center gap-2">
                    <div className="w-24 text-[12px] text-zinc-600">{labels[k]}</div>
                    <div className="flex-1 h-2 rounded bg-zinc-100 overflow-hidden">
                      <div className="h-full bg-zinc-800" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="w-10 text-right text-[11px] text-zinc-600 tabular-nums">{val}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Trait */}
      {trait ? (
        <section className="rounded border bg-white p-3">
          <div className="font-medium mb-1">{pickName(trait as any, lang) || trait.name}</div>
          <div className="text-sm text-zinc-700">
            {pickDesc(trait as any, lang) || trait.description || ""}
          </div>
        </section>
      ) : null}

      {/* Evolution chain */}
      {Array.isArray(evo) && evo.length > 1 ? (
        <section className="rounded border bg-white p-3">
          <div className="font-medium mb-2">{t("dex.evolution")}</div>
          <div className="flex items-center gap-2 overflow-x-auto">
            {evo.map((n: any, i: number) => {
              const mid = typeof n === "number" ? n : n.id;
              const label = typeof n === "number" ? `#${n}` : pickName(n as any, lang) || n.name;
              return (
                <div key={`${mid}-${i}`} className="inline-flex items-center gap-2">
                  <img
                    src={monsterImgUrlCN(typeof n === "number" ? { id: mid, name: label } : n, 180)}
                    onError={(e)=>{(e.currentTarget as HTMLImageElement).src="/monsters/placeholder.png"}}
                    alt=""
                    className="h-16 w-16 object-contain"
                  />
                  {i < evo.length - 1 ? <span className="opacity-60">→</span> : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Moves */}
      {(movePool?.length || legacyMoves?.length) ? (
        <section className="rounded border bg-white p-3">
          <div className="flex items-center gap-2 mb-2">
            <Link to={`?tab=${fromTab}&moves=pool`} className={`h-8 px-2 rounded border hover:bg-zinc-50 text-sm ${which === "pool" ? "bg-zinc-200" : ""}`}>
              {t("dex.learnable")}
            </Link>
            <Link to={`?tab=${fromTab}&moves=legacy`} className={`h-8 px-2 rounded border hover:bg-zinc-50 text-sm ${which === "legacy" ? "bg-zinc-200" : ""}`}>
              {t("dex.legacy")}
            </Link>
          </div>
          <MovesList list={which === "legacy" ? legacyMoves : movePool} />
        </section>
      ) : null}
    </div>
  );
}

function MovesList({ list }: { list: any[] }) {
  const { lang, t } = useI18n();

  return (
    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {(list ?? []).map((m: MoveOut & any) => {
        const tp = (m.move_type || m.type) as TypeOut | null;
        const cname = pickName(m as any, lang) || m.name;
        const desc = pickDesc(m as any, lang) || m.localized?.[lang]?.description || m.description || "";
        const category = (m.move_category || m.category || "").toUpperCase();
        const energy = (m.energy_cost ?? m.energy ?? null);
        const power = m.power ?? null;
        const isDef = category === "DEFENSE";
        const isSta = category === "STATUS";

        return (
          <div key={m.id} className="rounded border p-2">
            {/* fixed columns */}
            <div className="grid grid-cols-[18px,1fr,64px,28px,60px] items-center gap-2 text-sm">
              {/* type */}
              <div className="flex items-center justify-center">
                {tp?.name && typeIconUrl(tp.name) ? <img src={typeIconUrl(tp.name)!} alt="" width={16} height={16} /> : null}
              </div>

              {/* name + stone */}
              <div className="min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <div className="font-medium truncate" title={cname}>{cname}</div>
                  {m.is_move_stone ? <span className="text-[10px] rounded bg-amber-100 px-1 py-0.5">{t("dex.move_stone")}</span> : null}
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

            <div className="text-xs text-zinc-600 mt-1 line-clamp-2">{desc}</div>
          </div>
        );
      })}
      {!list?.length && <div className="text-zinc-500">{t("dex.noResults")}</div>}
    </div>
  );
}