import { NavLink } from "react-router-dom";
import { Home, Layers, CalendarDays, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Feed", icon: Home, end: true },
  { to: "/categories", label: "Groups", icon: Layers },
  { to: "/add", label: "", icon: Sparkles, primary: true },
  { to: "/timeline", label: "Timeline", icon: CalendarDays },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 safe-bottom">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/85 to-transparent" />
      <ul className="relative mx-auto flex max-w-md items-end justify-between px-4 pb-2 pt-3">
        {tabs.map(({ to, label, icon: Icon, end, primary }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-1.5 text-[10.5px] font-medium tracking-wide transition-colors",
                  primary
                    ? "text-primary-foreground"
                    : isActive
                      ? "text-foreground"
                      : "text-muted-foreground/70 hover:text-foreground"
                )
              }
            >
              {primary ? (
                <span className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow ring-4 ring-background transition-transform active:scale-95">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
              ) : (
                <>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
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
