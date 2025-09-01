import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export default function TrendArrow({ delta }: { delta?: number }) {
  if (delta === undefined) return null;
  if (delta > 0.5) return <span className="inline-flex items-center gap-1 text-emerald-600"><ArrowUpRight className="h-4 w-4"/> {delta.toFixed(1)}%</span>;
  if (delta < -0.5) return <span className="inline-flex items-center gap-1 text-red-600"><ArrowDownRight className="h-4 w-4"/> {delta.toFixed(1)}%</span>;
  return <span className="inline-flex items-center gap-1 text-muted-foreground"><Minus className="h-4 w-4"/> {delta.toFixed(1)}%</span>;
}
