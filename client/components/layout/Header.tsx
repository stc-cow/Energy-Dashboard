import { cn } from "@/lib/utils";
import { Link, NavLink } from "react-router-dom";

export default function Header() {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 w-full border-b border-white/10 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      )}
    >
      <div className="container mx-auto grid grid-cols-3 h-16 items-center">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2Fbd65b3cd7a86452e803a3d7dc7a3d048%2F0198dd0082b54c8c8c332a08688180d4?format=webp&width=800"
            alt="stc"
            className="h-8 w-auto object-contain"
          />
          <div className="text-white font-black text-[35px] leading-[35px] whitespace-nowrap ml-[360px]">
            COW Predictive Energy Dashboard
          </div>
        </Link>
        <div className="col-start-2" />
        <div className="flex items-center gap-6 justify-self-end col-start-3">
          <nav className="flex items-center gap-6 text-sm">
            <NavLink
              to="/heatmap"
              className={({ isActive }) =>
                isActive
                  ? "font-semibold text-white"
                  : "text-white/80 hover:text-white"
              }
            >
              <p>
                <strong>COW Distribution Map</strong>
              </p>
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
