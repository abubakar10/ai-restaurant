import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ChefHat,
  Sparkles,
  Menu,
  X,
  Moon,
  Sun,
  Boxes,
  Truck,
  ClipboardList,
  PackageOpen,
} from "lucide-react";
import { cn } from "../lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/recipes", label: "Recipes", icon: ChefHat },
  { to: "/items", label: "Items", icon: Boxes },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/suggestions", label: "AI PO", icon: Sparkles },
  { to: "/po-status", label: "PO status", icon: ClipboardList },
  { to: "/receiving", label: "Receiving", icon: PackageOpen },
];

export function Layout() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const isLight = theme === "light";
  const themeLabel = isLight ? "Switch to dark mode" : "Switch to light mode";

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] flex-col px-4 pb-16 pt-6 lg:flex-row lg:px-8 lg:pt-10">
      <div className="mb-4 flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 p-[1px] shadow-lg shadow-fuchsia-500/25">
            <div className="flex h-full w-full items-center justify-center rounded-[0.85rem] bg-card">
              <Sparkles className="h-4 w-4 text-cyan-300" />
            </div>
          </div>
          <div>
            <p className="font-display text-sm font-semibold tracking-tight text-foreground">
              Restaurant Management
            </p>
            <p className="text-[11px] text-muted">AI inventory · Operations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            aria-label={themeLabel}
            title={themeLabel}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-foreground transition hover:bg-white/[0.1]"
          >
            {isLight ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-foreground transition hover:bg-white/[0.1]"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu overlay"
              className="fixed inset-0 z-30 bg-black/60 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -320, opacity: 0.7 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0.7 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-40 w-72 border-r border-white/10 bg-card p-5 shadow-2xl lg:hidden"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-cyan-300" />
                  <span className="text-sm font-semibold text-foreground">Menu</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-foreground"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1">
                {nav.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                        isActive
                          ? "bg-white/[0.09] text-foreground ring-1 ring-white/[0.12]"
                          : "text-muted hover:bg-white/[0.06] hover:text-foreground"
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside className="mb-8 hidden shrink-0 flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.2)] lg:sticky lg:top-10 lg:mb-0 lg:flex lg:w-56 lg:self-start">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 p-[1px] shadow-lg shadow-fuchsia-500/25">
              <div className="flex h-full w-full items-center justify-center rounded-[0.9rem] bg-card">
                <Sparkles className="h-5 w-5 text-cyan-300" />
              </div>
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-foreground">
                Restaurant Management
              </p>
              <p className="text-xs text-muted">AI inventory · Operations</p>
            </div>
          </div>
        </motion.div>

        <button
          type="button"
          onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          aria-label={themeLabel}
          title={themeLabel}
          className="mb-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 text-sm font-medium text-foreground transition hover:bg-white/[0.1]"
        >
          {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {isLight ? "Dark mode" : "Light mode"}
        </button>

        <nav className="flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                  isActive
                    ? "text-foreground"
                    : "text-muted hover:bg-white/[0.06] hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/18 via-fuchsia-500/14 to-cyan-500/16 ring-1 ring-violet-400/35 shadow-[0_6px_18px_rgba(124,58,237,0.22)]"
                      transition={{ type: "spring", stiffness: 380, damping: 35 }}
                    />
                  )}
                  {isActive && (
                    <span
                      className="absolute bottom-1 top-1 left-1 w-1 rounded-full bg-gradient-to-b from-violet-500 via-fuchsia-500 to-cyan-400"
                      aria-hidden
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4 shrink-0" />
                  <span className="relative z-10">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 lg:pl-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
