import { AlertItem } from "@shared/api";
import { AlertTriangle, Fuel, Flame } from "lucide-react";

export default function AlertList({ items }: { items: AlertItem[] }) {
  const iconFor = (k: AlertItem["kind"]) => {
    switch (k) {
      case "fuel_low":
        return <Fuel className="h-4 w-4 text-red-600" />;
      case "co2_spike":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case "diesel_spike":
        return <Flame className="h-4 w-4 text-rose-600" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold">Alerts & Notifications</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No alerts.</div>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className="flex items-start gap-3 rounded-md border p-3">
              <div className="mt-0.5">{iconFor(a.kind)}</div>
              <div className="text-sm">
                <div className="font-medium">{a.message}</div>
                <div className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()} • {a.severity.toUpperCase()}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
