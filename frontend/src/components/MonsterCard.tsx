import { useQuery, useQueries } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import type { MonsterLiteOut, PersonalityOut, TypeOut, MoveOut } from "@/types";
import { pickName, pickFormName, useI18n } from "@/i18n";
import { useMemo } from "react";
import { monsterImageUrlByCN, monsterImageUrlByEN, monsterImageUrlById } from "@/lib/images";

/* ---------- helpers ---------- */

function typeNameRaw(t: any): string | undefined {
  return t && typeof t === "object" ? t.name : t;
}
function slugifyTypeName(name?: string | null): string | null {
  if (!name) return null;
  return name.toLowerCase().replace(/\s+/g, "-");
}
// /public/type-icons/{30|45|60}/{slug}.png
function typeIconUrl(type: any, size: 30 | 45 | 60 = 30): string | null {
  const slug = slugifyTypeName(typeNameRaw(type));
  return slug ? `/type-icons/${size}/${slug}.png` : null;
}

function TypeBadge({
  type,
  size = 30,
  label,
}: {
  type: any;
  size?: 30 | 45 | 60;
  label: string;
}) {
  const src = typeIconUrl(type, size);
  return (
    <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-xs">
      {src ? (
        <img
          src={src}
          alt=""
          width={size / 2}
          height={size / 2}
          className="inline-block"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
        />
      ) : null}
      {label}
    </span>
  );
}

function useMoveMap(ids: Array<number | 0 | undefined>) {
  const uniq = useMemo(
    () => Array.from(new Set(ids.filter((x): x is number => !!x && x > 0))),
    [ids]
  );
  const results = useQueries({
    queries: uniq.map((id) => ({
      queryKey: ["move", id],
      queryFn: () => endpoints.moveById(id).then((r) => r.data as MoveOut),
      enabled: !!id,
    })),
  });
  return useMemo(() => {
    const m = new Map<number, MoveOut>();
    results.forEach((r, i) => {
      const data = r.data;
      if (data) m.set(uniq[i]!, data);
    });
    return m;
  }, [results, uniq]);
}

/* ---------- component ---------- */

type Props = {
  monsterId?: number;
  personalityId?: number | null;
  legacyTypeId?: number | null;
  moveIds?: Array<number | 0 | undefined>;
  onClick?: () => void;
  imgSize?: 180 | 270 | 360;
  typeIconSize?: 30 | 45 | 60;
};

export default function MonsterCard({
  monsterId,
  personalityId,
  legacyTypeId,
  moveIds = [],
  onClick,
  imgSize = 180,
  typeIconSize = 30,
}: Props) {
  const { lang } = useI18n();

  const monsterQ = useQuery({
    queryKey: ["monster-lite", monsterId],
    queryFn: () => endpoints.monsterById(monsterId!).then((r) => r.data as MonsterLiteOut),
    enabled: !!monsterId,
  });
  const monster = monsterQ.data;
  const formLabel = pickFormName(monster, lang);

  // Image source chain: CN -> EN -> ID -> placeholder
  const cnSrc = monsterImageUrlByCN(monster, imgSize);
  const enSrc = monsterImageUrlByEN(monster, imgSize);
  const idSrc = monsterImageUrlById(monster, imgSize);
  const chain = [cnSrc, enSrc, idSrc, "/monsters/placeholder.png"].filter(
    Boolean
  ) as string[];

  // Query lists lazily; placeholders render even if not loaded yet.
  const persQ = useQuery({
    queryKey: ["personalities"],
    queryFn: () => endpoints.personalities().then((r) => r.data as PersonalityOut[]),
    enabled: true,
  });
  const typeQ = useQuery({
    queryKey: ["types"],
    queryFn: () => endpoints.types().then((r) => r.data as TypeOut[]),
    enabled: true,
  });

  const persName =
    personalityId && persQ.data
      ? pickName(persQ.data.find((p) => p.id === personalityId), lang)
      : "";

  const legacyObj =
    legacyTypeId && typeQ.data ? typeQ.data.find((t) => t.id === legacyTypeId) : null;
  const legacyName = legacyObj ? pickName(legacyObj, lang) : "";

  const moveMap = useMoveMap(moveIds);

  const mainTypeLabel = monster?.main_type ? pickName(monster.main_type as any, lang) : "";
  const subTypeLabel = monster?.sub_type ? pickName(monster.sub_type as any, lang) : "";

  return (
    <button
      onClick={onClick}
      className="w-full rounded border border-zinc-200 bg-white hover:border-zinc-300 transition p-3 text-left"
    >
      {monster ? (
        <div className="flex gap-3">
          {/* avatar */}
          <div className="shrink-0">
            {chain.length ? (
              <img
                src={chain[0]!}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded-md object-contain bg-zinc-50"
                data-fallback-step={0}
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  const step = Number(img.dataset.fallbackStep || "0");
                  const next = step + 1;
                  if (next < chain.length) {
                    img.dataset.fallbackStep = String(next);
                    img.src = chain[next]!;
                  } else if (img.src !== "/monsters/placeholder.png") {
                    img.src = "/monsters/placeholder.png";
                  }
                }}
              />
            ) : (
              <div className="h-12 w-12 rounded-md bg-zinc-100" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {/* name + form */}
            <div className="font-medium truncate">
              {pickName(monster as any, lang)}
              {formLabel && <span className="ml-1 text-zinc-500">({formLabel})</span>}
            </div>

            {/* type chips */}
            <div className="mt-1 flex flex-wrap gap-1">
              {monster?.main_type && (
                <TypeBadge type={monster.main_type} size={typeIconSize} label={mainTypeLabel} />
              )}
              {monster?.sub_type && (
                <TypeBadge type={monster.sub_type} size={typeIconSize} label={subTypeLabel} />
              )}
            </div>

            {/* personality + legacy — ALWAYS VISIBLE with placeholders */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              {/* Personality chip */}
              <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5">
                <span className="whitespace-nowrap">
                  {lang === "zh" ? "性格" : "Personality"}:
                </span>
                <span className={persName ? "text-zinc-700" : "text-zinc-500"}>
                  {persName || "—"}
                </span>
              </span>

              {/* Legacy chip */}
              <span className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5">
                <span className="whitespace-nowrap">
                  {lang === "zh" ? "血脉" : "Legacy"}:
                </span>
                {legacyObj && typeIconUrl(legacyObj, typeIconSize) ? (
                  <img
                    src={typeIconUrl(legacyObj, typeIconSize)!}
                    alt=""
                    width={typeIconSize / 2}
                    height={typeIconSize / 2}
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                  />
                ) : null}
                <span className={legacyName ? "text-zinc-700" : "text-zinc-500"}>
                  {legacyName || "—"}
                </span>
              </span>
            </div>

            {/* moves as chips */}
            {moveIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {moveIds.map((id, idx) => {
                  if (!id) {
                    return (
                      <span
                        key={`empty-${idx}`}
                        className="rounded bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-500"
                      >
                        {lang === "zh" ? `技能${idx + 1}` : `Move ${idx + 1}`}: —
                      </span>
                    );
                  }
                  const move = moveMap.get(id);
                  const name = move ? pickName(move as any, lang) : "…";
                  return (
                    <span
                      key={`${id}-${idx}`}
                      className="rounded border bg-white px-2 py-0.5 text-[11px] text-zinc-700"
                      title={name}
                    >
                      {name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-zinc-500">{lang === "zh" ? "选择精灵…" : "Select monster…"}</div>
      )}
    </button>
  );
}