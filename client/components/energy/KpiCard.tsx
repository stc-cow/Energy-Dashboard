export default function KpiCard({
  title,
  value,
  unit,
  footer,
}: {
  title: string;
  value: number;
  unit: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-card p-3 lg:p-4 shadow-none h-full flex flex-col items-center text-center justify-between">
      <div className="text-sm lg:text-base tracking-wider text-white/90 font-bold">
        {title}
      </div>
      <div className="mt-1 flex flex-col items-center justify-center">
        <div className="text-2xl lg:text-3xl font-extrabold tabular-nums text-white">
          <span className="tabular-nums">{value.toLocaleString()}</span>
          <span className="ml-1 text-xs font-bold text-white/80 align-baseline">
            {unit}
          </span>
        </div>
      </div>
      {footer ? (
        <div className="mt-2 text-xs text-white/80 font-semibold text-center line-clamp-2">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
