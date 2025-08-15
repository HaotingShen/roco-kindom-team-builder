import { useState } from "react";

export default function PageTabs({
  tabs
}: { tabs: { key: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div>
      <div className="flex gap-2 border-b mb-3">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${active === t.key ? "border-zinc-900" : "border-transparent text-zinc-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{tabs.find(t => t.key === active)?.content}</div>
    </div>
  );
}