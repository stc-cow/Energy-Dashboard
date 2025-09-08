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
            src="https://cdn.builder.io/api/v1/image/assets%2Fbd65b3cd7a86452e803a3d7dc7a3d048%2F57a8a3cd81a24a69ad9bd34e4e70feb7"
            alt="stc"
            className="h-8 w-auto object-contain"
          />
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2Fbd65b3cd7a86452e803a3d7dc7a3d048%2F1d632f43770b4dc9b1111ec6a5024279?format=webp&width=800"
            alt="COW"
            className="h-8 w-auto object-contain"
          />
        </Link>
        <div className="flex-1 text-center hidden sm:block">
          <div className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            <strong>COW Predictive Energy Dashboard</strong>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6 text-sm">
            <NavLink
              to="/heatmap"
              className={({ isActive }) =>
                isActive
                  ? "font-semibold text-white"
                  : "text-white/80 hover:text-white"
              }
            >
              Heat Map
            </NavLink>
          </nav>
          <a
            href="https://aces-co.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ACES website"
          >
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fbd65b3cd7a86452e803a3d7dc7a3d048%2F49b74b93ac974c858232234345139aee?format=webp&width=800"
              alt="ACES"
              className="h-8 min-h-[60px] w-auto object-contain bg-transparent"
            />
          </a>
        </div>
      </div>
    </header>
  );
}
