import { NavLink } from "react-router-dom";

const link = "block px-4 py-2 rounded hover:bg-zinc-100";
const active = "bg-zinc-200 font-medium";

export default function Sidebar() {
  return (
    <aside
      className="fixed left-0 top-0 h-full border-r border-zinc-200 bg-white"
      style={{ width: "var(--sidebar-w)" }}
    >
      <div className="h-14 flex items-center px-4 border-b">
        <span className="font-semibold">Roco Builder</span>
      </div>
      <nav className="p-3 space-y-1">
        <NavLink to="/build" className={({isActive}) => `${link} ${isActive ? active : ""}`}>Build</NavLink>
        <NavLink to="/analyze" className={({isActive}) => `${link} ${isActive ? active : ""}`}>Analyze</NavLink>
        <NavLink to="/dex" className={({isActive}) => `${link} ${isActive ? active : ""}`}>Dex</NavLink>
        <NavLink to="/teams/1" className={({isActive}) => `${link} ${isActive ? active : ""}`}>Saved Team</NavLink>
      </nav>
      <div className="px-3 mt-4">
        <div className="text-xs text-zinc-500 mb-2">Current Team</div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square bg-zinc-100 rounded" />
          ))}
        </div>
      </div>
    </aside>
  );
}