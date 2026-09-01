import { BookOpen, Building2, CheckCircle2, GraduationCap, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  CheckerRecommendation,
  CheckerRecommendationsResponse,
  CheckerResultGroup,
} from "@/api";

const GROUP_META: Record<CheckerResultGroup, { title: string; className: string }> = {
  strongMatches: {
    title: "Strong Matches",
    className: "bg-green-500/15 text-green-700 border-green-500/30",
  },
  competitiveOptions: {
    title: "Competitive Options",
    className: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  },
  nearHistoricalRange: {
    title: "Near Historical Range",
    className: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  notEligible: {
    title: "Not Eligible",
    className: "bg-red-500/15 text-red-700 border-red-500/30",
  },
};

const GROUPS: CheckerResultGroup[] = [
  "strongMatches",
  "competitiveOptions",
  "nearHistoricalRange",
  "notEligible",
];

function ResultCard({
  result,
  modeLabel,
  group,
}: {
  result: CheckerRecommendation;
  modeLabel: string;
  group: CheckerResultGroup;
}) {
  const ReasonIcon = group === "notEligible" ? XCircle : CheckCircle2;
  const reasonIconClass = group === "notEligible" ? "text-red-500" : "text-green-600";

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <GraduationCap className="h-6 w-6 text-primary shrink-0" />
          <Badge variant="outline">{modeLabel}</Badge>
        </div>
        <CardTitle className="text-lg leading-snug">{result.courseName}</CardTitle>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" /> {result.university}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{result.faculty}</Badge>
          <Badge variant="outline">{result.degreeDuration} years</Badge>
          {result.medium && <Badge variant="outline">{result.medium}</Badge>}
          <Badge variant="outline" className="bg-primary/5">{result.requiredStream} stream</Badge>
        </div>

        {result.requiredSubjects.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Required subjects</p>
            <div className="flex flex-wrap gap-1.5">
              {result.requiredSubjects.map((s, i) => (
                <Badge key={`${s.subjectName}-${i}`} variant="secondary" className="text-xs">
                  {s.subjectName}
                  {s.minimumGrade ? ` ≥ ${s.minimumGrade}` : ""}
                  {s.requirementType === "one_of" ? " (either)" : ""}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-2 text-sm">
          <p>
            Student Z-score: <span className="font-medium">{result.studentZScore}</span>
          </p>
          {result.officialCutoff != null ? (
            <p>
              Official cutoff: <span className="font-medium">{result.officialCutoff}</span>
            </p>
          ) : (
            <p>
              Estimated range:{" "}
              <span className="font-medium">
                {result.estimatedMin ?? "?"} - {result.estimatedMax ?? "?"}
              </span>
              {result.estimatedCenter != null ? ` (center ${result.estimatedCenter})` : ""}
            </p>
          )}
          {result.confidence && (
            <p>
              Confidence: <span className="font-medium">{result.confidence}</span>
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <BookOpen className="h-4 w-4 shrink-0" />
          <span>
            {result.sourceHandbook}
            {result.sourcePage != null ? `, page ${result.sourcePage}` : ""}
          </span>
        </div>

        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {result.reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <ReasonIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${reasonIconClass}`} />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function CheckerResults({ response }: { response: CheckerRecommendationsResponse }) {
  const total = GROUPS.reduce((count, group) => count + response.groups[group].length, 0);

  if (total === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        No verified programmes found for this academic year and stream yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{response.resultModeLabel}</Badge>
        <Badge variant="outline">{response.academicYear}</Badge>
        <Badge variant="outline">{response.district}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{response.disclaimer}</p>

      {GROUPS.map((group) => {
        const meta = GROUP_META[group];
        const results = response.groups[group];
        if (results.length === 0) return null;
        return (
          <section key={group} className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={meta.className}>{meta.title}</Badge>
              <span className="text-sm text-muted-foreground">{results.length}</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((result) => (
                <ResultCard
                  key={`${group}-${result.programmeId}`}
                  result={result}
                  modeLabel={response.resultModeLabel}
                  group={group}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
