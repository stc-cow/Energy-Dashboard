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
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6 text-sm" />
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2Fbd65b3cd7a86452e803a3d7dc7a3d048%2F49b74b93ac974c858232234345139aee?format=webp&width=800"
            alt="ACES"
            className="h-8 min-h-[60px] w-auto object-contain bg-transparent"
          />
        </div>
      </div>
    </header>
  );
}
