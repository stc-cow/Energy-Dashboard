import React, { createContext, useContext, useState } from "react";

type MapContextType = {
  highlighted: string | null;
  highlightSite: (id: string | null) => void;
};

const MapContext = createContext<MapContextType | null>(null);

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  return (
    <MapContext.Provider value={{ highlighted, highlightSite: setHighlighted }}>
      {children}
    </MapContext.Provider>
  );
};

export function useMap() {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMap must be used inside MapProvider");
  return ctx;
}
