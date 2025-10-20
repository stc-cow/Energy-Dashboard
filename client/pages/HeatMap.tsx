import Layout from "@/components/layout/Layout";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchCowStatusGeoPoints, fetchHierarchy } from "@/lib/api";
import { MapContainer, TileLayer, useMap, Marker, Popup } from "react-leaflet";
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
      radius: 15,
      blur: 10,
      maxZoom: 10,
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
  const [zoom, setZoom] = useState(6);
  const { data: hierarchy } = useQuery({
    queryKey: ["hierarchy"],
    queryFn: fetchHierarchy,
  });
  const { data: statusPoints = { onAir: [], offAir: [] } } = useQuery({
    queryKey: ["cow-status-geo"],
    queryFn: () => fetchCowStatusGeoPoints({ level: "national" }),
    enabled: true,
  });

  const combinedPoints = useMemo(
    () => [...(statusPoints.onAir || []), ...(statusPoints.offAir || [])],
    [statusPoints],
  );

  // Create a map of site coordinates to site IDs from hierarchy
  const siteMap = useMemo(() => {
    const map = new Map<string, string>();
    if (hierarchy?.sites) {
      hierarchy.sites.forEach((site: any) => {
        const key = `${site.lat},${site.lng}`;
        map.set(key, site.id || site.name);
      });
    }
    return map;
  }, [hierarchy]);

  const bounds = useMemo(() => {
    const pts = combinedPoints;
    if (!pts.length) return L.latLngBounds(L.latLng(16, 34), L.latLng(32, 56));
    const b = L.latLngBounds(pts.map((p) => [p.lat, p.lng]) as any);
    return b.pad(0.2);
  }, [combinedPoints]);

  function MapZoomListener() {
    const map = useMap();
    useEffect(() => {
      const handleZoom = () => {
        setZoom(map.getZoom());
      };
      map.on("zoom", handleZoom);
      setZoom(map.getZoom());
      return () => {
        map.off("zoom", handleZoom);
      };
    }, [map]);
    return null;
  }

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
            style={{ height: 600, width: "100%" }}
            bounds={bounds}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapZoomListener />
            {zoom < 10 && (
              <HeatLayer
                points={combinedPoints}
                gradient={{
                  0.0: "blue",
                  0.5: "green",
                  0.8: "yellow",
                  1.0: "#ff6666",
                }}
                intensity={1}
              />
            )}
            {zoom >= 10 && combinedPoints.map((point, idx) => {
              const siteId = siteMap.get(`${point.lat},${point.lng}`);
              return (
                <Marker
                  key={idx}
                  position={[point.lat, point.lng]}
                >
                  <Popup>
                    <div style={{ fontWeight: "bold", color: "#000" }}>
                      {siteId || "Site"}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
        {combinedPoints.length === 0 && (
          <div className="text-sm text-amber-300">
            No coordinates found in columns L & M. Please ensure the sheet has
            Lat in L and Lng in M for each row within KSA.
          </div>
        )}
      </div>
    </Layout>
  );
}
