import { MapPin } from "lucide-react";
import { Site } from "@shared/api";

export default function MapPanel({ sites }: { sites: Site[] }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">Interactive Map (Geo Heatmap)</div>
        <div className="text-xs text-muted-foreground">Drill-down by region and city</div>
      </div>
      <div className="grid min-h-64 place-items-center rounded-lg bg-gradient-to-br from-primary/5 to-accent">
        <div className="text-center text-sm text-muted-foreground">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary">
            <MapPin className="h-4 w-4" /> Map integration pending
          </div>
          <p>
            Connect a map provider (Leaflet/MapLibre) to render KSA geo heatmap. Showing {sites.length} sites.
          </p>
        </div>
      </div>
    </div>
  );
}
