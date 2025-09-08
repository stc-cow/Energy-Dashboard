import Layout from "@/components/layout/Layout";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFuelGeoPoints, fetchHierarchy } from "@/lib/api";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Link } from "react-router-dom";

function HeatLayer({ points }: { points: Array<{ lat: number; lng: number; value: number }> }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const heatPoints: any[] = points.map((p) => [p.lat, p.lng, Math.max(0.01, (100 - p.value) / 100)]);
    const layer = (L as any).heatLayer(heatPoints, {
      radius: 20,
      blur: 25,
      maxZoom: 11,
      minOpacity: 0.3,
    });
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, points]);
  return null;
}

export default function HeatMap() {
  const { data: hierarchy } = useQuery({ queryKey: ["hierarchy"], queryFn: fetchHierarchy });
  const { data: points = [] } = useQuery({ queryKey: ["fuel-geo"], queryFn: () => fetchFuelGeoPoints({ level: "national" }), enabled: true });

  const bounds = useMemo(() => {
    if (!points.length) return L.latLngBounds(L.latLng(16, 34), L.latLng(32, 56)); // KSA approx
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng]) as any);
    return b.pad(0.2);
  }, [points]);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="relative rounded-xl border overflow-hidden" style={{ backgroundColor: "rgb(92, 11, 162)", borderColor: "rgb(129, 73, 171)", borderWidth: 1, borderRadius: 12, marginTop: 16, overflowX: "hidden", overflowY: "hidden", position: "relative" }}>
          <div className="absolute right-2 top-2 z-[1000]">
            <Button asChild variant="secondary" size="icon" aria-label="Close heat map">
              <a href="#/">
                <X />
              </a>
            </Button>
          </div>
          <MapContainer style={{ height: 600, width: "100%" }} bounds={bounds} scrollWheelZoom={true}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <HeatLayer points={points} />
          </MapContainer>
        </div>
        {points.length === 0 && (
          <div className="text-sm text-amber-300">No coordinates found in columns H & I. Please ensure the sheet has Lat in H and Lng in I for each row within KSA.</div>
        )}
        <p className="text-xs text-muted-foreground">
          Note: Hotter areas indicate lower fuel levels (redder = lower %).
        </p>
      </div>
    </Layout>
  );
}
