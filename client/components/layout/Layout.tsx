import Header from "./Header";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { clearSheetCache } from "@/lib/api";

export default function Layout({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary">
      <Header />
      <div className="container mx-auto px-4 pt-2 flex justify-center">
        <Button
          aria-label="Refresh data"
          variant="secondary"
          size="sm"
          className="-ml-0.5"
          onClick={() => {
            clearSheetCache();
            queryClient.invalidateQueries({ queryKey: ["hierarchy"] });
            queryClient.invalidateQueries({ queryKey: ["kpis"] });
            queryClient.invalidateQueries({ queryKey: ["ts"] });
            queryClient.invalidateQueries({ queryKey: ["accum"] });
            queryClient.invalidateQueries({ queryKey: ["benchmark"] });
            queryClient.invalidateQueries({ queryKey: ["alerts"] });
          }}
        >
          <RotateCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
      <main className="container mx-auto px-4 py-6">{children}</main>
      <footer
        className="mt-10 mb-5 border-t py-6 text-xs text-muted-foreground"
        style={{ borderTop: "1px solid rgba(137, 14, 230, 1)" }}
      >
        <div className="container mx-auto px-8">
          © {new Date().getFullYear()} STC — COW Energy Analytics
        </div>
      </footer>
    </div>
  );
}
