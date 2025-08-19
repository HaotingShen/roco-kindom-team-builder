import React, { createContext, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endpoints } from "@/lib/api";
import type { TypeOut } from "@/types";

export type Lang = "en" | "zh";

/* ---------------- data localization ---------------- */

export function pickName(x: any, lang: Lang): string {
  if (!x) return "";
  if (lang === "zh" && x.localized?.zh != null) {
    const zh = x.localized.zh;
    if (typeof zh === "string") return zh;
    if (typeof zh === "object") {
      if (typeof zh.name === "string") return zh.name;
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
    if (typeof zh === "object" && typeof zh.description === "string")
      return zh.description;
  }
  return x.description ?? "";
}

/** Useful for localizing types by name string */
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

/* ---------------- UI localization ---------------- */

type Dict = Record<string, Record<string, string>>;

const ui: Record<Lang, Dict> = {
  en: {
    common: {
      select: "Select…",
      loading: "Loading…",
      edit: "Edit",
      refresh: "Refresh",
      share: "Share",
      search: "Search…",
      showMore: "Show more",
      showLess: "Show less",
    },
    sidebar: {
      build: "Build",
      analyze: "Analyze",
      dex: "Dex",
      teams: "Saved Team",
    },
    top: {
      builder: "Team Builder",
      analyze: "Analysis",
      dex: "Dex",
      teams: "Teams",
      lang_en_zh: "EN / 中文",
      lang_zh_en: "中文 / EN",
    },
    builder: {
      slot: "Slot {{n}}",
      inspectorTitle: "Inspector — Slot {{n}}",
      changeMonster: "Change Monster",
      pickAMonster: "Pick a monster",
      tipAfterPick:
        "Tip: After choosing a monster, you can set Personality, Legacy Type, Moves, and Talents.",
      personality: "Personality",
      effects: "Effects: {{text}}",
      legacyType: "Legacy Type",
      legacyGrants:
        "Legacy Type grants: {{name}}. You can use it in one move slot.",
      legacyMissing: "No legacy move found for this Legacy Type.",
      legacyHint:
        "You can pick at most 1 Legacy Move.",
      moves: "Moves",
      moveN: "Move {{n}}",
      talents: "Talents",
      talentsHint: "At most 3 stats can be boosted.",
      magicItem: "Magic Item:",
      analyze: "Analyze",
      analyzing: "Analyzing…",
      selectMonster: "Select monster…",
      searchMonsters: "Search monsters…",
      // validation
      v_pickMonster: "Pick a monster",
      v_setPersonality: "Set a personality",
      v_chooseLegacy: "Choose a legacy type",
      v_select4Moves: "Select 4 moves",
      v_pickTalent: "Pick at least 1 talent boost",
      v_max3: "At most 3 stats can be boosted",
      v_pickMagicItem: "Pick a magic item",
      incompleteTeamMsg: "Team is incomplete. Fill all 6 slots (monster, personality, legacy type, 4 moves, at least 1 talent boost).",
      // slot status labels
      status_complete: "Complete",
      status_incomplete: "Incomplete",
      status_empty: "Empty",
    },
    stats: {
      noStats: "No stats.",
      noEnergy: "No energy profile.",
    },
    labels: {
      hp: "HP",
      phyAtk: "Phy Atk",
      magAtk: "Mag Atk",
      phyDef: "Phy Def",
      magDef: "Mag Def",
      spd: "Speed",
      legacy: "Legacy",
      leader: "Leader",
    },
    analysis: {
      teamOverview: "Team Overview",
      magicItem: "Magic Item",
      offensiveGaps: "Offensive Coverage Gaps:",
      teamWeakTo: "Team Vulnerable To:",
      magicItemTargets: "Valid Targets:",
      perMonster: "Per-Monster Analysis",
      recommendations: "Recommendations",
      avgEnergy: "Avg Energy",
      hasZeroCost: "Has 0-cost move",
      hasRestore: "Has energy restore",
      counters: "Counters",
      noCounters: "No counters",
      defStatusCount: "Defense/Status",
      synergyWith: "Trait synergy with",
      playTips: "Playing Tips",
    },
  },
  zh: {
    common: {
      select: "选择…",
      loading: "载入中…",
      edit: "编辑",
      refresh: "刷新",
      share: "分享",
      search: "搜索…",
      showMore: "展开",
      showLess: "收起",
    },
    sidebar: {
      build: "构筑",
      analyze: "分析",
      dex: "图鉴",
      teams: "队伍存档",
    },
    top: {
      builder: "队伍构筑",
      analyze: "分析",
      dex: "图鉴",
      teams: "队伍",
      lang_en_zh: "EN / 中文",
      lang_zh_en: "中文 / EN",
    },
    builder: {
      slot: "槽位 {{n}}",
      inspectorTitle: "面板 — 槽位 {{n}}",
      changeMonster: "更换精灵",
      pickAMonster: "选择精灵",
      tipAfterPick: "提示：选择精灵后可设置性格、血脉、技能与个体值。",
      personality: "性格",
      effects: "效果：{{text}}",
      legacyType: "血脉",
      legacyGrants: "血脉提供：{{name}}。该技能仅可占用一个技能栏位。",
      legacyMissing: "该血脉没有可用的血脉技能。",
      legacyHint: "最多选择1个血脉技能。",
      moves: "技能",
      moveN: "技能{{n}}",
      talents: "个体值",
      talentsHint: "最多提升3项个体值。",
      magicItem: "血脉魔法：",
      analyze: "分析",
      analyzing: "分析中…",
      selectMonster: "选择精灵…",
      searchMonsters: "搜索精灵…",
      // validation
      v_pickMonster: "选择一只精灵",
      v_setPersonality: "设置性格",
      v_chooseLegacy: "选择血脉",
      v_select4Moves: "选择4个技能",
      v_pickTalent: "最少提升1项个体值",
      v_max3: "最多提升3项个体值",
      v_pickMagicItem: "请选择一个血脉魔法",
      incompleteTeamMsg: "队伍未完成：请补全 6 个槽位（精灵、性格、血脉、4 个技能、至少 1 项个体值提升）。",
      // slot status labels
      status_complete: "已完成",
      status_incomplete: "待完善",
      status_empty: "未选择",
    },
    stats: {
      noStats: "暂无属性数据。",
      noEnergy: "暂无能量分布。",
    },
    labels: {
      hp: "生命",
      phyAtk: "物攻",
      magAtk: "魔攻",
      phyDef: "物防",
      magDef: "魔防",
      spd: "速度",
      legacy: "血脉",
      leader: "首领",
    },
    analysis: {
      teamOverview: "队伍总览",
      magicItem: "血脉魔法",
      offensiveGaps: "队伍缺少打击面：",
      teamWeakTo: "队伍易被克制：",
      magicItemTargets: "可使用目标：",
      perMonster: "单体分析",
      recommendations: "优化建议",
      avgEnergy: "平均能量",
      hasZeroCost: "含0费技能",
      hasRestore: "含回能技能",
      counters: "应对技能数",
      noCounters: "无应对技能",
      defStatusCount: "防御/状态类技能数",
      synergyWith: "特性与以下技能契合",
      playTips: "玩法技巧",
    },
  },
};

// simple dot-path lookup with {{var}} interpolation
function resolve(dict: Dict, path: string, vars?: Record<string, any>) {
  const val = path.split(".").reduce<any>((a, k) => (a ? a[k] : undefined), dict);
  const str = typeof val === "string" ? val : path; // fallback: key itself
  return typeof vars === "object"
    ? str.replace(/\{\{(\w+)\}\}/g, (_, k) => `${vars[k] ?? ""}`)
    : str;
}

/* ---------------- context ---------------- */

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, any>) => string;
};

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    (localStorage.getItem("lang") as Lang) || "en"
  );
  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang: (l) => {
        localStorage.setItem("lang", l);
        setLang(l);
      },
      t: (key, vars) => resolve(ui[lang], key, vars) || resolve(ui.en, key, vars),
    }),
    [lang]
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}