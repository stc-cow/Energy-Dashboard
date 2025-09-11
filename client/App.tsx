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

// Normalize and rethrow errors so Vite overlay receives proper Error objects
if (typeof window !== "undefined" && !(window as any).__error_normalizer_installed) {
  (window as any).__error_normalizer_installed = true;

  // Capture synchronous runtime errors, normalize and rethrow asynchronously
  window.addEventListener(
    "error",
    (e: ErrorEvent) => {
      try {
        // If the event has a proper Error object with stack, let it proceed
        if (e.error && e.error.stack) return;

        // Prevent default handling (Vite overlay may receive malformed event)
        e.preventDefault();

        const msg = e.message || String(e.error || "Unknown error");
        const err = new Error(msg);
        try {
          // include location hint
          err.stack = `${err.name}: ${err.message}\n    at ${location.href}`;
        } catch {
          // ignore
        }
        // Rethrow asynchronously so other listeners (like Vite overlay) get a clean Error
        setTimeout(() => {
          throw err;
        }, 0);
      } catch (err) {
        // ensure we don't throw from the handler
        console.error("Error normalizer failed:", err);
      }
    },
    true, // capture phase to run before other handlers
  );

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    try {
      const reason = ev.reason as any;
      if (reason && reason.stack) return; // already an Error
      ev.preventDefault();
      const msg = (reason && reason.message) || String(reason || "Unhandled rejection");
      const err = new Error(msg);
      try {
        err.stack = `${err.name}: ${err.message}\n    at ${location.href}`;
      } catch {}
      setTimeout(() => {
        throw err;
      }, 0);
    } catch (err) {
      console.error("UnhandledRejection normalizer failed:", err);
    }
  });
}

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
      // Return a Response with a valid HTTP status code so callers can handle it
      return new Response("", {
        status: 502,
        statusText: "network error",
      }) as any;
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

const container = document.getElementById("root");
if (container) {
  // reuse root across HMR/reloads to avoid createRoot being called multiple times
  if (!(window as any).__app_root) {
    (window as any).__app_root = createRoot(container);
  }
  (window as any).__app_root.render(<App />);
} else {
  // fallback
  console.error("Root container not found: #root");
}
