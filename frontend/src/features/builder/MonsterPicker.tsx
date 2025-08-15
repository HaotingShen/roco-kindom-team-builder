import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { endpoints } from "@/lib/api";
import type { MonsterLiteOut } from "@/types";
import useDebounce from "@/hooks/useDebounce";
import { useI18n, pickName, useTypeIndex, localizeTypeName, pickFormName } from "@/i18n";

export default function MonsterPicker({
  onPick,
}: {
  onPick: (m: MonsterLiteOut) => void;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 250);
  const { lang } = useI18n();
  const { index: typeIndex } = useTypeIndex();

  const list = useQuery({
    queryKey: ["monsters", { name: dq }],
    queryFn: () => endpoints.monsters({ name: dq }).then((r) => r.data),
  });

  // normalize API result shape and sort by id ASC (do NOT mutate query data)
  const rawItems: MonsterLiteOut[] = list.data?.items ?? list.data ?? [];
  const items = useMemo(
    () =>
      [...rawItems].sort(
        (a: any, b: any) => Number(a?.id ?? 0) - Number(b?.id ?? 0)
      ),
    [rawItems]
  );

  // helper: API may return type as string or { name: string }
  const typeNameRaw = (t: any): string | undefined =>
    t && typeof t === "object" ? t.name : t;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        {lang === "zh" ? "选择精灵" : "Pick a monster"}
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={lang === "zh" ? "搜索精灵…" : "Search monsters…"}
        className="w-full h-9 border rounded px-3"
      />

      <div className="grid grid-cols-2 gap-2 max-h-80 overflow-auto">
        {items.map((m: any) => {
          const mainType = localizeTypeName(
            typeNameRaw(m.main_type),
            lang,
            typeIndex
          );
          const subType = localizeTypeName(
            typeNameRaw(m.sub_type),
            lang,
            typeIndex
          );
          const formLabel = pickFormName(m, lang);
          const displayName = pickName(m, lang) || m.name;

          return (
            <button
              key={String(m.id)}
              onClick={() => onPick(m)}
              className="p-2 text-left border rounded hover:bg-zinc-50"
              title={displayName}
            >
              <div className="font-medium">
                {displayName}
                {formLabel && (
                  <span className="ml-1 text-xs text-zinc-500">
                    ({formLabel})
                  </span>
                )}
              </div>

              <div className="mt-1 text-xs text-zinc-600">
                {mainType}
                {subType ? ` / ${subType}` : ""}
                {m.is_leader_form
                  ? lang === "zh"
                    ? " • 首领"
                    : " • Leader"
                  : ""}
              </div>
            </button>
          );
        })}

        {!list.isLoading && items.length === 0 && (
          <div className="col-span-2 text-xs text-zinc-500 py-6 text-center">
            {lang === "zh" ? "没有结果" : "No results"}
          </div>
        )}
      </div>

      {list.isLoading && (
        <div className="text-xs text-zinc-500">
          {lang === "zh" ? "载入中…" : "Loading…"}
        </div>
      )}
    </div>
  );
}