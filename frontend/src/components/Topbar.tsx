import { useNavigate, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";

export default function Topbar() {
  const nav = useNavigate();
  const loc = useLocation();
  const { lang, setLang, t } = useI18n();

  const title = loc.pathname.startsWith("/dex")
    ? t("top.dex")
    : loc.pathname.startsWith("/analyze")
    ? t("top.analyze")
    : loc.pathname.startsWith("/teams")
    ? t("top.teams")
    : t("top.builder");

  return (
    <header className="h-14 border-b border-zinc-200 bg-white flex items-center gap-3 px-4 sticky top-0 z-10">
      <h1 className="font-medium text-zinc-800">{title}</h1>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <button onClick={() => setLang(lang === "en" ? "zh" : "en")}
                className="h-9 px-3 rounded border"
                title="Toggle language">
          {lang === "en" ? t("top.lang_en_zh") : t("top.lang_zh_en")}
        </button>
        <input placeholder={t("common.search")} className="h-9 w-72 rounded border border-zinc-300 px-3" />
        <button onClick={() => nav(0)} className="h-9 px-3 rounded border">{t("common.refresh")}</button>
        <button className="h-9 px-3 rounded bg-zinc-900 text-white">{t("common.share")}</button>
      </div>
    </header>
  );
}