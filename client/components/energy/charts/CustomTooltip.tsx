import React from "react";

export default function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  // payload: [{ name, value, payload }, ...]
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        padding: 10,
        borderRadius: 8,
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any, idx: number) => (
        <div
          key={idx}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 4,
          }}
        >
          <div style={{ opacity: 0.9 }}>{p.name}</div>
          <div style={{ fontWeight: 700 }}>{p.value}</div>
        </div>
      ))}
    </div>
  );
}
