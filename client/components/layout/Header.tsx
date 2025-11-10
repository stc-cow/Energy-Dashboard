import { cn } from "@/lib/utils";
import { Link, NavLink } from "react-router-dom";

export default function Header() {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 w-full border-b border-white/10 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      )}
    >
      <div className="container mx-auto grid grid-cols-3 h-[90px] items-center">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2Fbd65b3cd7a86452e803a3d7dc7a3d048%2F0198dd0082b54c8c8c332a08688180d4?format=webp&width=800"
            alt="stc"
            className="h-6 w-auto object-contain"
          />
        </Link>
        <div className="col-start-2 text-center text-[25px]">
          <p className="text-white font-black leading-[16px] whitespace-nowrap">
            <strong>COW Predictive Energy Dashboard</strong>
          </p>
        </div>
        <div className="flex items-center gap-4 justify-self-end col-start-3">
          <nav className="flex items-center gap-4 text-xs">
            <NavLink
              to="/heatmap"
              className={({ isActive }) =>
                isActive
                  ? "font-semibold text-white"
                  : "text-white/80 hover:text-white"
              }
            >
              <p />
            </NavLink>
            <NavLink
              to="/trends"
              className={({ isActive }) =>
                isActive
                  ? "font-semibold text-white"
                  : "text-white/80 hover:text-white"
              }
            >
              <p />
            </NavLink>
          </nav>
          <a
            href="https://aces-co.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ACES website"
          >
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fbd65b3cd7a86452e803a3d7dc7a3d048%2Ff13ebfdd5372404fad3f58e87a2908e4?format=webp&width=800"
              alt="ACES"
              className="h-24 w-24 object-contain bg-transparent"
            />
          </a>
        </div>
      </div>
    </header>
  );
}
