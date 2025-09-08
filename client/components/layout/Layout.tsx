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
      <Header />
      <main className="container mx-auto px-4 py-6">{children}</main>
      <footer className="mt-10 mb-5 border-t py-4 text-xs text-muted-foreground">
        <div className="container mx-auto px-8">Powered by ACES MS</div>
      </footer>
    </div>
  );
}
