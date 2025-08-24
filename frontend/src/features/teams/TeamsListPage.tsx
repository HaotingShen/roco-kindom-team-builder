import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { endpoints } from "@/lib/api";
import { formatLocal } from "@/lib/datetime";
import type { TeamOut } from "@/types";
import { useI18n, pickName } from "@/i18n";

export default function TeamsListPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();

  const teams = useQuery<TeamOut[]>({
    queryKey: ["teams"],
    queryFn: () => endpoints.listTeams().then(r => r.data),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const remove = useMutation({
    mutationFn: (id: number) => endpoints.deleteTeam(id).then(r => r.data),
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: ["teams"] });
      const prev = qc.getQueryData<TeamOut[]>(["teams"]);
      qc.setQueryData<TeamOut[]>(["teams"], (old) =>
        (old ?? []).filter(t => t.id !== id)
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["teams"], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });

  const onDeleteClick = (id: number) => {
    if (remove.isPending) return;
    const ok = window.confirm(
      t("teams.confirmDelete") ?? "Delete this team? This cannot be undone."
    );
    if (!ok) return;
    remove.mutate(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-lg">{t("teams.manageTeams")}</h2>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(teams.data ?? []).map((team) => (
          <div key={team.id} className="rounded border bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Link to={`/teams/${team.id}`} className="font-medium">
                {team.name || `Team #${team.id}`}
              </Link>
              <span className="text-xs text-zinc-500">
                {t("teams.lastModified")}: {formatLocal(team.updated_at, lang === "zh" ? "zh-CN" : "en-US")}
              </span>
            </div>
            <div className="text-xs text-zinc-600">
              {t("analysis.magicItem")}: {pickName(team.magic_item as any, lang) || "—"}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Link
                to={`/teams/${team.id}`}
                className="inline-flex items-center justify-center h-8 px-2 border rounded text-sm
                          text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                {t("teams.open")}
              </Link>

              <button
                type="button"
                onClick={() => onDeleteClick(team.id)}
                disabled={remove.isPending}
                className="inline-flex items-center justify-center h-8 px-2 border rounded text-sm
                          text-zinc-700 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 cursor-pointer"
              >
                {t("teams.delete")}
              </button>
            </div>
          </div>
        ))}
        {!teams.data?.length && (
          <div className="text-zinc-500">{t("teams.noTeams")}</div>
        )}
      </div>
    </div>
  );
}