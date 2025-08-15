import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import type { TypeOut } from "@/types";

export type Lang = "en" | "zh";

/* -------------------- Provider & hook -------------------- */

const LANG_KEY = "app.lang";

function readLang(): Lang {
  if (typeof window === "undefined") return "en";
  const raw = (localStorage.getItem(LANG_KEY) as Lang | null) ?? "en";
  return raw === "zh" ? "zh" : "en";
}

type I18nCtx = { lang: Lang; setLang: (l: Lang) => void };
const Ctx = createContext<I18nCtx>({ lang: "en", setLang: () => {} });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang());

  // persist + reflect <html lang="..">
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  // update from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_KEY) setLangState(readLang());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem(LANG_KEY, l);
    }
  };

  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

/* -------------------- Robust pickers -------------------- */

export function pickName(x: any, lang: Lang): string {
  if (!x) return "";
  if (lang === "zh" && x.localized?.zh != null) {
    const zh = x.localized.zh;
    if (typeof zh === "string") return zh;                 // e.g. { zh: "草" }
    if (typeof zh === "object") {
      if (typeof zh.name === "string") return zh.name;     // e.g. { zh: { name: "四维降解" } }
      if (typeof zh.title === "string") return zh.title;
    }
  }
  return x.name ?? x.key ?? "";
}

export function pickDesc(x: any, lang: Lang): string {
  if (!x) return "";
  if (lang === "zh" && x.localized?.zh != null) {
    const zh = x.localized.zh;
    if (typeof zh === "string") return zh;
    if (typeof zh === "object" && typeof zh.description === "string") return zh.description;
  }
  return x.description ?? "";
}

/* -------------------- Type helpers -------------------- */

export function useTypeIndex() {
  const q = useQuery({
    queryKey: ["types-index"],
    queryFn: () => endpoints.types().then((r) => r.data as TypeOut[]),
  });
  const index = useMemo(() => {
    const m: Record<string, string> = {};
    (q.data ?? []).forEach((t) => {
      m[t.name] = pickName(t, "zh");
    });
    return m;
  }, [q.data]);
  return { index, isLoading: q.isLoading };
}

export function localizeTypeName(
  name: string | undefined,
  lang: Lang,
  index: Record<string, string>
): string {
  if (!name) return "";
  return lang === "zh" ? index[name] ?? name : name;
}

/* -------------------- Form helper -------------------- */
/** For non-default forms, prefer localized.zh.form; otherwise fall back to the English form. */
export function pickFormName(x: any, lang: Lang): string {
  const form: string = x?.form ?? "";
  if (!form || form.toLowerCase() === "default") return "";
  if (lang === "zh") {
    const zh = x?.localized?.zh;
    if (zh && typeof zh === "object" && typeof zh.form === "string" && zh.form.trim()) {
      return zh.form;
    }
  }
  return form;
}