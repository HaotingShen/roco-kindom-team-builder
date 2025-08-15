import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { endpoints } from "@/lib/api";
import { useBuilderStore } from "../builder/builderStore";
import type { TeamCreate } from "@/types";

export default function TeamsListPage() {
  const nav = useNavigate();
  const builder = useBuilderStore();

  const teams = useQuery({
    queryKey: ["teams"],
    queryFn: () => endpoints.listTeams().then(r => r.data)
  });

  const createFromBuilder = useMutation({
    mutationFn: (payload: TeamCreate) => endpoints.createTeam(payload).then(r => r.data),
    onSuccess: (t) => nav(`/teams/${t.id ?? t.team_id ?? ""}`)
  });

  const remove = useMutation({
    mutationFn: (id: number) => endpoints.deleteTeam(id).then(r => r.data),
    onSuccess: () => teams.refetch()
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-lg">Saved Teams</h2>
        <button
          onClick={() => createFromBuilder.mutate(builder.toPayload())}
          className="h-9 px-4 rounded bg-zinc-900 text-white"
        >
          Save Current Team
        </button>
      </div>

      <div className="rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="text-zinc-500">
            <tr className="text-left">
              <th className="py-2 px-3">Name</th>
              <th>Magic Item</th>
              <th>Monsters</th>
              <th className="w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(teams.data ?? []).map((t: any) => (
              <tr key={t.id} className="border-t">
                <td className="py-2 px-3">
                  <Link to={`/teams/${t.id}`} className="underline">{t.name ?? `Team #${t.id}`}</Link>
                </td>
                <td>{t.magic_item?.name ?? t.magic_item_id ?? "—"}</td>
                <td>{(t.user_monsters ?? []).length}</td>
                <td className="space-x-2">
                  <Link to={`/teams/${t.id}`} className="px-2 py-1 border rounded inline-block">Open</Link>
                  <button
                    onClick={() => remove.mutate(t.id)}
                    className="px-2 py-1 border rounded inline-block"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!teams.data?.length && (
              <tr><td className="py-6 px-3 text-zinc-500" colSpan={4}>No teams yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}