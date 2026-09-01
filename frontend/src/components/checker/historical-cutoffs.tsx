import type { HistoricalCutoffPoint } from "@/api";

export function HistoricalCutoffs({ history }: { history: HistoricalCutoffPoint[] }) {
  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground">No historical cutoff data available for this district.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {history.map((point) => (
        <span
          key={point.academicYear}
          className="rounded-md border border-[hsl(var(--border))] px-2 py-1 text-muted-foreground"
        >
          {point.academicYear}: <span className="font-medium text-foreground">{point.minimumZScore}</span>
        </span>
      ))}
    </div>
  );
}
