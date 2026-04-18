import { NavLink } from "react-router-dom";
import { Home, Layers, CalendarDays, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Feed", icon: Home, end: true },
  { to: "/categories", label: "Categories", icon: Layers },
  { to: "/add", label: "", icon: Plus, primary: true },
  { to: "/timeline", label: "Timeline", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur-xl safe-bottom">
      <ul className="mx-auto flex max-w-md items-end justify-between px-3 pt-2">
        {tabs.map(({ to, label, icon: Icon, end, primary }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium transition-colors",
                  primary
                    ? "text-primary-foreground"
                    : isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              {primary ? (
                <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-transform active:scale-95">
                  <Icon className="h-6 w-6" strokeWidth={2.2} />
                </span>
              ) : (
                <>
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
