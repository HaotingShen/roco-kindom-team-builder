import { useNavigate, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useBuilderStore } from "@/features/builder/builderStore";

export default function Topbar() {
  const nav = useNavigate();
  const loc = useLocation();
  const { lang, setLang, t } = useI18n();

  const resetBuilder = useBuilderStore(s => s.reset);

  const title = loc.pathname.startsWith("/dex")
    ? t("topbar.dex")
    : loc.pathname.startsWith("/teams")
    ? t("topbar.teams")
    : t("topbar.builder");

  const isOnBuilder =
    loc.pathname === "/" ||
    loc.pathname.startsWith("/build")

  const onResetClick = () => {
    const ok = window.confirm(
      t("topbar.confirmReset") ?? "Reset the builder? This clears the current team and analysis."
    );
    if (!ok) return;

    resetBuilder();

    if (!isOnBuilder) nav("/build");
  };

  return (
    <header className="h-14 border-b border-zinc-200 bg-white flex items-center gap-3 px-4 sticky top-0 z-10">
      <h1 className="font-medium text-zinc-800">{title}</h1>
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Reset appears only on the builder */}
        {isOnBuilder && (
          <button
            onClick={onResetClick}
            className="h-9 px-3 rounded border hover:bg-zinc-50 cursor-pointer"
          >
            {t("topbar.reset") ?? "Reset"}
          </button>
        )}

        <button
          onClick={() => setLang(lang === "en" ? "zh" : "en")}
          className="h-9 px-3 rounded border hover:bg-zinc-50 cursor-pointer"
          title={t("topbar.toggleLanguage") ?? "Toggle language"}
        >
          {lang === "en" ? t("topbar.lang_en_zh") : t("topbar.lang_zh_en")}
        </button>

        <input
          placeholder={t("topbar.search")}
          className="h-9 w-72 rounded border border-zinc-300 px-3"
        />
      </div>
    </header>
  );
}