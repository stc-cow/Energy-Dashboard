import { cn } from "@/lib/utils";
import { Link, NavLink } from "react-router-dom";

export default function Header() {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 w-full border-b border-white/10 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2Fbd65b3cd7a86452e803a3d7dc7a3d048%2F49b74b93ac974c858232234345139aee?format=webp&width=800"
            alt="ACES"
            className="h-8 w-auto object-contain bg-transparent"
          />
          <div>
            <div className="text-sm uppercase tracking-widest text-muted-foreground">
              COW Energy
            </div>
            <div className="text-lg font-semibold">Kingdom-wide Dashboard</div>
          </div>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <NavLink
            to="/"
            className={({ isActive }) =>
              cn("hover:text-primary", isActive && "text-primary font-semibold")
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/reports"
            className={({ isActive }) =>
              cn("hover:text-primary", isActive && "text-primary font-semibold")
            }
          >
            Reports
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
