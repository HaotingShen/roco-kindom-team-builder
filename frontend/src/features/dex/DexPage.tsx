import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import PageTabs from "@/components/PageTabs";
import { useState } from "react";
import useDebounce from "@/hooks/useDebounce";
import type { MoveOut, MonsterLiteOut } from "@/types";

function MonstersTab() {
  const [name, setName] = useState("");
  const dn = useDebounce(name, 250);
  const { data } = useQuery({
    queryKey: ["dex-monsters", dn],
    queryFn: () => endpoints.monsters({ name: dn }).then(r => r.data)
  });
  const items: MonsterLiteOut[] = data?.items ?? data ?? [];

  return (
    <div className="grid grid-cols-[280px_1fr] gap-3">
      <aside className="rounded border bg-white p-3">
        <div className="text-sm font-medium mb-2">Filters</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name…"
          className="w-full h-9 border rounded px-3"
        />
      </aside>
      <section className="rounded border bg-white p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-2">Name</th>
              <th>Main</th>
              <th>Sub</th>
              <th>Leader</th>
            </tr>
          </thead>
          <tbody>
            {items.map(m => (
              <tr key={m.id} className="border-t">
                <td className="py-2">{m.name} <span className="text-xs text-zinc-500">({m.form})</span></td>
                <td>{m.main_type?.name}</td>
                <td>{m.sub_type?.name ?? "—"}</td>
                <td>{m.is_leader_form ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MovesTab() {
  const [name, setName] = useState("");
  const dn = useDebounce(name, 250);
  const { data } = useQuery({
    queryKey: ["dex-moves", dn],
    queryFn: () => endpoints.moves({ name: dn }).then(r => r.data)
  });
  const items: MoveOut[] = data?.items ?? data ?? [];

  return (
    <div className="rounded border bg-white p-3">
      <div className="flex items-center gap-2 mb-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Move name…"
          className="h-9 border rounded px-3"
        />
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="py-2">Name</th>
            <th>Type</th>
            <th>Category</th>
            <th>Counter?</th>
          </tr>
        </thead>
        <tbody>
          {items.map(m => (
            <tr key={m.id} className="border-t">
              <td className="py-2">{m.name}</td>
              <td>{m.type?.name}</td>
              <td>{m.category}</td>
              <td>{m.has_counter ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DexPage() {
  return (
    <PageTabs
      tabs={[
        { key: "monsters", label: "Monsters", content: <MonstersTab /> },
        { key: "moves", label: "Moves", content: <MovesTab /> }
      ]}
    />
  );
}