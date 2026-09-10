import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { useListOpportunities, type OpportunityType } from "@/api/opportunities";

const TYPES: { value: OpportunityType | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "scholarship", label: "Scholarships" },
  { value: "internship", label: "Internships" },
  { value: "competition", label: "Competitions" },
  { value: "grant", label: "Grants" },
  { value: "other", label: "Other" },
];

export default function Opportunities() {
  usePageTitle("Opportunities & Scholarships");
  const [type, setType] = useState<OpportunityType | "">("");
  const [stream, setStream] = useState("");
  const { data: opportunities, isLoading } = useListOpportunities({
    type: type || undefined,
    stream: stream || undefined,
    activeOnly: true,
  });

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Opportunities & Scholarships</h1>
        <p className="text-sm text-muted-foreground">
          Events, internships, competitions, and scholarships curated by SkillPath and partner universities.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {TYPES.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={type === t.value ? "default" : "outline"}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Filter by stream"
          value={stream}
          onChange={(e) => setStream(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : (opportunities ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No opportunities found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(opportunities ?? []).map((o) => (
            <Card key={o.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{o.title}</p>
                  <Badge variant="secondary">{o.type}</Badge>
                </div>
                {o.organization && <p className="text-xs text-muted-foreground">{o.organization}</p>}
                <p className="text-sm">{o.description}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {o.eligibilityStream && <span>Stream: {o.eligibilityStream}</span>}
                  {o.amount && <span>· {o.amount}</span>}
                  {o.applicationDeadline && (
                    <span>· Deadline: {new Date(o.applicationDeadline).toLocaleDateString()}</span>
                  )}
                </div>
                {o.applicationUrl && (
                  <a
                    href={o.applicationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-sm text-primary hover:underline"
                  >
                    Apply / Learn more →
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
