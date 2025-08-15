import { useNavigate, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";

export default function Topbar() {
  const nav = useNavigate();
  const loc = useLocation();
  const { lang, setLang } = useI18n();

  return (
    <header className="h-14 border-b border-zinc-200 bg-white flex items-center gap-3 px-4 sticky top-0 z-10">
      <h1 className="font-medium text-zinc-800">
        {loc.pathname.startsWith("/dex") ? "Dex" :
         loc.pathname.startsWith("/analyze") ? "Analysis" :
         loc.pathname.startsWith("/teams") ? "Teams" : "Team Builder"}
      </h1>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <button
          onClick={() => setLang(lang === "en" ? "zh" : "en")}
          className="h-9 px-3 rounded border"
          title="Toggle language"
        >
          {lang === "en" ? "EN / 中文" : "中文 / EN"}
        </button>
        <input placeholder="Search…" className="h-9 w-72 rounded border border-zinc-300 px-3" />
        <button onClick={() => nav(0)} className="h-9 px-3 rounded border">Refresh</button>
        <button className="h-9 px-3 rounded bg-zinc-900 text-white">Share</button>
      </div>
    </header>
  );
}