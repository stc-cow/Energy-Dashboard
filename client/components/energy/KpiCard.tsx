import TrendArrow from "./TrendArrow";

export default function KpiCard({ title, value, unit, delta }: { title: string; value: number; unit: string; delta?: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-1 flex items-end justify-between">
        <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">{unit}</span></div>
        <TrendArrow delta={delta} />
      </div>
    </div>
  );
}
