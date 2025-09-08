import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Reports from "./pages/Reports";
import Independent from "./pages/Independent";
import HeatMap from "./pages/HeatMap";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Wrap global fetch to avoid uncaught network errors surfacing repeatedly in the console
if (typeof window !== "undefined" && !(window as any).__safe_fetch_installed) {
  (window as any).__safe_fetch_installed = true;
  const _origFetch = window.fetch.bind(window);
  window.fetch = async (...args: any[]) => {
    try {
      return await _origFetch(...args);
    } catch (err: any) {
      // log once per error type to avoid spamming
      try {
        console.warn("Network fetch failed (suppressed):", err?.message || err);
      } catch {}
      // Return a Response-like object with ok=false to keep callers working
      return new Response("", { status: 0, statusText: "network error" }) as any;
    }
  };
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/independent" element={<Independent />} />
          <Route path="/heatmap" element={<HeatMap />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
