import Header from "./Header";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { clearSheetCache } from "@/lib/api";
import { useEffect } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      clearSheetCache();
      queryClient.invalidateQueries({ queryKey: ["hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
      queryClient.invalidateQueries({ queryKey: ["ts"] });
      queryClient.invalidateQueries({ queryKey: ["accum"] });
      queryClient.invalidateQueries({ queryKey: ["benchmark"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    };
    const now = new Date();
    const msToNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    const timeoutId = setTimeout(
      () => {
        refresh();
        const id = setInterval(refresh, 60_000);
        (window as any).__auto_refresh_interval = id;
      },
      Math.max(0, msToNextMinute),
    );
    return () => {
      clearTimeout(timeoutId);
      if ((window as any).__auto_refresh_interval)
        clearInterval((window as any).__auto_refresh_interval);
    };
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      <div className="print:hidden">
        <Header />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block">
        <div className="container mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <a
              href="https://aces-co.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ACES website"
            >
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2Fbd65b3cd7a86452e803a3d7dc7a3d048%2F49b74b93ac974c858232234345139aee?format=webp&width=400"
                alt="ACES"
                style={{ height: 40, objectFit: "contain" }}
              />
            </a>
            <div className="text-center">
              <div className="font-extrabold text-xl">
                COW Predictive Energy Dashboard
              </div>
            </div>
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fbd65b3cd7a86452e803a3d7dc7a3d048%2F57a8a3cd81a24a69ad9bd34e4e70feb7?format=webp&width=400"
              alt="stc"
              style={{ height: 40, objectFit: "contain" }}
            />
          </div>
        </div>
      </div>

      <main
        className="container mx-auto"
        style={{ fontWeight: 400, maxWidth: 1400, width: "100%", margin: "0 auto", padding: "0 16px 24px" }}
      >
        {children}
      </main>

      {/* Screen footer */}
      <footer
        className="mt-10 mb-5 border-t py-4 text-xs text-muted-foreground print:hidden"
        style={{ borderTop: "1px solid rgb(129, 73, 171)" }}
      >
        <div className="container mx-auto px-8">
          <p>
            <strong>Powered by ACES MS</strong>
          </p>
        </div>
      </footer>

      {/* Print-only footer with timestamp */}
      <div className="hidden print:block">
        <div className="container mx-auto px-8 py-2 text-xs text-muted-foreground">
          Generated on {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
}
