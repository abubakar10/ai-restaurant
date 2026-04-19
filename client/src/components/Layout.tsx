import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ChefHat,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/sales", label: "Sales", icon: ShoppingCart },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/recipes", label: "Recipes", icon: ChefHat },
  { to: "/suggestions", label: "AI PO", icon: Sparkles },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] flex-col px-4 pb-16 pt-6 md:flex-row md:px-8 md:pt-10">
      <aside className="mb-8 flex shrink-0 flex-col md:sticky md:top-10 md:mb-0 md:w-56 md:self-start">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 p-[1px] shadow-lg shadow-fuchsia-500/25">
              <div className="flex h-full w-full items-center justify-center rounded-[0.9rem] bg-[#0c0a14]">
                <Sparkles className="h-5 w-5 text-cyan-300" />
              </div>
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-white">
                Restaurant Management
              </p>
              <p className="text-xs text-muted">AI inventory · Operations</p>
            </div>
          </div>
        </motion.div>

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
                    ? "text-white"
                    : "text-muted hover:bg-white/[0.06] hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.12]"
                      transition={{ type: "spring", stiffness: 380, damping: 35 }}
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

      <main className="min-w-0 flex-1 md:pl-4">
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
