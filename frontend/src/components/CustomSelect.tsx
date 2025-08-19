import { useEffect, useLayoutEffect, useRef, useState, useId } from "react";

export type CustomSelectOption = {
  value: number;
  label: string;
  rightLabel?: string;
  disabled?: boolean;
};

type Props = {
  value: number | null | undefined;
  options: CustomSelectOption[];
  onChange: (v: number) => void;
  placeholder?: string;
  ariaLabel?: string;

  /** Optional styling hooks */
  buttonClassName?: string;     // e.g. "w-full" or "min-w-[200px]"
  containerClassName?: string;  // e.g. "flex-1 min-w-0"
  menuClassName?: string;       // to tweak menu if needed
};

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = "—",
  ariaLabel,
  buttonClassName = "w-full",
  containerClassName = "",
  menuClassName = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const [maxH, setMaxH] = useState<number>(288); // ~max-h-72
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  function recomputeFrom(btn: HTMLButtonElement) {
    const r = btn.getBoundingClientRect();
    const GAP = 8;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const spaceBelow = vh - r.bottom - GAP;
    const spaceAbove = r.top - GAP;
    const flipUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    setPlacement(flipUp ? "top" : "bottom");
    const usable = Math.max(120, Math.floor(flipUp ? spaceAbove : spaceBelow));
    setMaxH(usable);
  }

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const n = e.target as Node;
      if (popRef.current && !popRef.current.contains(n) && btnRef.current && !btnRef.current.contains(n)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Keep placement accurate while open (no flicker)
  useLayoutEffect(() => {
    if (!open) return;
    const handler = () => { if (btnRef.current) recomputeFrom(btnRef.current); };
    handler();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    window.visualViewport?.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
      window.visualViewport?.removeEventListener("resize", handler);
    };
  }, [open]);

  const current = options.find(o => o.value === value);
  const display = current ? current.label : placeholder;

  // Compute BEFORE opening to avoid initial down-then-up blink
  const toggleOpen = () => {
    if (open) { setOpen(false); return; }
    if (btnRef.current) recomputeFrom(btnRef.current);
    setOpen(true);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      if (btnRef.current) recomputeFrom(btnRef.current);
      setOpen(true);
      return;
    }
    if (open && e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={`relative ${containerClassName}`}>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={toggleOpen}
        onKeyDown={onKeyDown}
        className={`h-9 border rounded px-3 flex items-center justify-between cursor-pointer ${buttonClassName}`}
      >
        <span className="truncate">{display}</span>
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 7l5 6 5-6" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          ref={popRef}
          id={listboxId}
          role="listbox"
          className={`absolute z-20 w-full border rounded bg-white shadow overflow-auto left-0
            ${placement === "bottom" ? "top-full mt-1" : "bottom-full mb-1"} ${menuClassName}`}
          style={{ maxHeight: maxH }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {options.map(opt => {
            const selected = opt.value === value;
            const disabled = !!opt.disabled;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={selected}
                aria-disabled={disabled || undefined}
                onClick={() => {
                  if (disabled) return;
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-zinc-50
                  ${selected ? "bg-zinc-100" : ""} ${disabled ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""}`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.rightLabel ? (
                  <span className="ml-auto text-right text-xs text-zinc-600">{opt.rightLabel}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}