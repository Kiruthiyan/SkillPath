import { Badge } from "@/components/ui/badge";
import type { EstimateStatusLabel } from "@/api";

const ESTIMATE_STATUS_META: Record<EstimateStatusLabel, { label: string; className: string }> = {
  strong_historical_position: {
    label: "Strong Historical Position",
    className: "bg-green-500/15 text-green-700 border-green-500/30",
  },
  competitive_range: {
    label: "Competitive Range",
    className: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  },
  near_range: {
    label: "Near Range",
    className: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  below_recent_range: {
    label: "Below Recent Range",
    className: "bg-red-500/15 text-red-700 border-red-500/30",
  },
};

export function EstimateStatusBadge({ status }: { status: EstimateStatusLabel | null }) {
  if (!status) return null;
  const meta = ESTIMATE_STATUS_META[status];
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  );
}
