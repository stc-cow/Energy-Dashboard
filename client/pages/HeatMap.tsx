import Layout from "@/components/layout/Layout";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCowStatusGeoPoints, fetchHierarchy } from "@/lib/api";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Link } from "react-router-dom";

function HeatLayer({
  points,
  gradient,
  intensity = 0.8,
}: {
  points: Array<{ lat: number; lng: number; value?: number }>;
  gradient: Record<number, string>;
  intensity?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const heatPoints: any[] = points.map((p) => [
      p.lat,
      p.lng,
      p.value ?? intensity,
    ]);
    const layer = (L as any).heatLayer(heatPoints, {
      radius: 20,
      blur: 25,
      maxZoom: 11,
      minOpacity: 0.3,
      gradient,
    });
    layer.addTo(map);
    return () => {
      layer.remove();
    };
  }, [map, points, gradient, intensity]);
  return null;
}

export default function HeatMap() {
  const { data: hierarchy } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: fetchHierarchy,
  });
  const { data: statusPoints = { onAir: [], offAir: [] } } = useQuery({
    queryKey: ["cow-status-geo"],
    queryFn: () => fetchCowStatusGeoPoints({ level: "national" }),
    enabled: true,
  });

  const bounds = useMemo(() => {
    const pts = [...(statusPoints.onAir || []), ...(statusPoints.offAir || [])];
    if (!pts.length)
      return L.latLngBounds(L.latLng(16, 34), L.latLng(32, 56));
    const b = L.latLngBounds(pts.map((p) => [p.lat, p.lng]) as any);
    return b.pad(0.2);
  }, [statusPoints]);

  return (
    <Layout>
      <div className="space-y-4">
        <div
          className="relative rounded-xl border overflow-hidden"
          style={{
            backgroundColor: "rgb(92, 11, 162)",
            borderColor: "rgb(129, 73, 171)",
            borderWidth: 1,
            borderRadius: 12,
            marginTop: 16,
            overflowX: "hidden",
            overflowY: "hidden",
            position: "relative",
          }}
        >
          <div className="absolute right-2 top-2 z-[1000]">
            <Button
              asChild
              variant="secondary"
              size="icon"
              aria-label="Close heat map"
            >
              <a href="#/">
                <X />
              </a>
            </Button>
          </div>
          <MapContainer
            style={{ height: 600, width: "100%", background: "#ffffff" }}
            bounds={bounds}
            maxBounds={KSA_BOUNDS}
            maxBoundsViscosity={1.0}
            scrollWheelZoom={true}
            worldCopyJump={false}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              noWrap={true}
            />
            <HeatLayer
              points={statusPoints.onAir}
              gradient={{ 0.4: "#a7f3d0", 0.7: "#10b981", 1: "#065f46" }}
              intensity={0.8}
            />
            <HeatLayer
              points={statusPoints.offAir}
              gradient={{ 0.4: "#fecaca", 0.7: "#ef4444", 1: "#7f1d1d" }}
              intensity={0.8}
            />
          </MapContainer>
        </div>
        {statusPoints.onAir.length + statusPoints.offAir.length === 0 && (
          <div className="text-sm text-amber-300">
            No coordinates found in columns L & M. Please ensure the sheet has
            Lat in L and Lng in M, and COWSTATUS (ON-AIR/OFF-AIR) is present.
          </div>
        )}
      </div>
    </Layout>
  );
}
