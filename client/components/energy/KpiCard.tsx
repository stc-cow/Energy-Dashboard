import TrendArrow from "./TrendArrow";

export default function KpiCard({
  title,
  value,
  unit,
}: {
  title: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-card p-6 lg:p-8 shadow-none h-36 md:h-40 lg:h-44 flex flex-col items-center justify-center text-center">
      <div className="text-lg lg:text-xl tracking-wider text-white/90 font-bold">
        {title}
      </div>
      <div className="mt-2 flex flex-col items-center justify-center">
        <div className="text-4xl lg:text-5xl font-extrabold tabular-nums text-white">
          <span className="tabular-nums">{value.toLocaleString()}</span>
          <span className="ml-1 text-sm font-bold text-white/80 align-baseline">{unit}</span>
        </div>
      </div>
    </div>
  );
}
