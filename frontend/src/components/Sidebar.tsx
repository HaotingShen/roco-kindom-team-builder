import { NavLink } from "react-router-dom";
import { useI18n } from "@/i18n";

const link = "block px-4 py-2 rounded hover:bg-zinc-100";
const active = "bg-zinc-200 font-medium";

export default function Sidebar() {
  const { t } = useI18n();
  return (
    <aside className="fixed left-0 top-0 h-full border-r border-zinc-200 bg-white"
           style={{ width: "var(--sidebar-w)" }}>
      <div className="h-14 flex items-center px-4 border-b">
        <span className="font-semibold">Roco Team Builder</span>
      </div>
      <nav className="p-3 space-y-1">
        <NavLink to="/build"  className={({isActive}) => `${link} ${isActive ? active : ""}`}>{t("sidebar.build")}</NavLink>
        <NavLink to="/dex"    className={({isActive}) => `${link} ${isActive ? active : ""}`}>{t("sidebar.dex")}</NavLink>
        <NavLink to="/teams/1"className={({isActive}) => `${link} ${isActive ? active : ""}`}>{t("sidebar.teams")}</NavLink>
      </nav>
    </aside>
  );
}