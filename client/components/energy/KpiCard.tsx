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
      <div className="text-lg lg:text-xl uppercase tracking-wider text-white/90 font-bold">
        {title}
      </div>
      <div className="mt-2 flex flex-col items-center justify-center">
        <div className="text-4xl lg:text-5xl font-extrabold tabular-nums text-white">
          {value.toLocaleString()}{" "}
          <div className="text-sm font-medium text-white/80">
            {unit}
          </div>
        </div>
      </div>
    </div>
  );
}
