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
    <div className="rounded-xl border border-white/20 bg-card p-6 lg:p-8 shadow-none min-h-40 flex flex-col items-center text-center">
      <div className="text-lg lg:text-xl tracking-wider text-white/90 font-bold">
        {title}
      </div>
      <div className="mt-2 flex flex-col items-center justify-center">
        <div className="text-4xl lg:text-5xl font-extrabold tabular-nums text-white">
          <span className="tabular-nums">{value.toLocaleString()}</span>
          <span className="ml-1 text-sm font-bold text-white/80 align-baseline">
            {unit}
          </span>
        </div>
      </div>
      {footer ? (
        <div className="mt-3 text-xs text-white/80 font-semibold text-center">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
