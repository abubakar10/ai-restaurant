import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../lib/utils";

type Option = { value: string; label: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
};

export function DarkSelect({
  options,
  value,
  onChange,
  disabled,
  placeholder = "Select…",
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#14101f]/95 px-4 text-left text-sm text-zinc-100 shadow-inner backdrop-blur-sm transition-colors",
          "hover:border-white/18 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-500/35",
          disabled && "cursor-not-allowed opacity-50"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-zinc-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-white/12 bg-[#1a1628] py-1 shadow-[0_16px_48px_rgba(0,0,0,0.55)] ring-1 ring-white/5"
            role="listbox"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm text-zinc-100 transition-colors",
                      active
                        ? "bg-violet-600/25 text-white"
                        : "hover:bg-white/[0.08]"
                    )}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{opt.label}</span>
                    {active && (
                      <Check className="h-4 w-4 shrink-0 text-violet-300" />
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
