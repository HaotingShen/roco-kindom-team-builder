import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";

export default function SavedTeamPage() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["team", id],
    queryFn: () => endpoints.getTeam(id!).then(r => r.data),
    enabled: !!id
  });

  if (isLoading) return <div>Loading…</div>;
  if (!data) return <div>Not found.</div>;

  return (
    <div className="grid grid-cols-[1fr_260px] gap-4">
      <section className="rounded border bg-white p-3">
        <div className="font-medium mb-2">{data.name ?? `Team #${id}`}</div>
        <div className="grid grid-cols-3 gap-3">
          {(data.user_monsters ?? []).map((um: any, i: number) => (
            <div key={i} className="rounded border p-3">
              <div className="text-sm text-zinc-600 mb-1">Monster #{um.monster_id}</div>
              <div className="text-xs text-zinc-500">
                Moves: {[um.move1_id, um.move2_id, um.move3_id, um.move4_id].filter(Boolean).join(", ")}
              </div>
            </div>
          ))}
        </div>
      </section>
      <aside className="rounded border bg-white p-3 space-y-2">
        <div className="font-medium">Actions</div>
        <button className="w-full h-9 border rounded">Edit</button>
        <button className="w-full h-9 border rounded">Duplicate</button>
        <button className="w-full h-9 border rounded">Export JSON</button>
        <button className="w-full h-9 bg-zinc-900 text-white rounded">Analyze</button>
      </aside>
    </div>
  );
}