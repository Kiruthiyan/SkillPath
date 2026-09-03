import { useState, useMemo, useEffect } from "react";
import { BookOpen, Building2, CheckCircle2, Clock, GraduationCap, Search, Target, X, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  CheckerRecommendation,
  CheckerRecommendationsResponse,
  CheckerResultGroup,
} from "@/api";

function ResultDetailsModal({
  result,
  onClose,
}: {
  result: CheckerRecommendation | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!result) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [result, onClose]);

  if (!result) return null;

  const isEligible = result.meetsHandbookRequirements && result.zscoreDiff != null && result.zscoreDiff >= -0.0001;
  const ReasonIcon = isEligible ? CheckCircle2 : XCircle;
  const reasonIconClass = isEligible
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="space-y-2 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg leading-snug">{result.courseName}</CardTitle>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium text-foreground/80">{result.university}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {result.requiredSubjects.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Required subjects</p>
              <div className="flex flex-wrap gap-1">
                {result.requiredSubjects.map((s, i) => (
                  <Badge key={`${s.subjectName}-${i}`} variant="secondary" className="text-[11px] px-2 py-0.5">
                    {s.subjectName}
                    {s.minimumGrade ? ` ≥ ${s.minimumGrade}` : ""}
                    {s.requirementType === "one_of" ? " (either)" : ""}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.specialRequirements.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Special requirements</p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {result.specialRequirements.map((rule) => (
                  <li key={rule}>• {rule}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground pt-0.5">
            <BookOpen className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              {result.sourceHandbook}
              {result.sourcePage != null ? `, page ${result.sourcePage}` : ""}
            </span>
          </div>

          <ul className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-[hsl(var(--border))]">
            {result.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5">
                <ReasonIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${reasonIconClass}`} />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultCard({
  result,
  modeLabel,
  onViewDetails,
}: {
  result: CheckerRecommendation;
  modeLabel: string;
  onViewDetails: () => void;
}) {
  const meets = result.meetsHandbookRequirements && result.zscoreDiff != null && result.zscoreDiff >= -0.0001;
  const diff = result.zscoreDiff;

  return (
    <Card className={cn(
      "transition-all hover:shadow-md border",
      meets ? "hover:border-emerald-500/50 border-emerald-500/20" : "hover:border-red-500/40 border-[hsl(var(--border))]"
    )}>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <GraduationCap className={cn(
            "h-6 w-6 shrink-0",
            meets ? "text-primary" : "text-muted-foreground"
          )} />
          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            <Badge variant="outline" className="text-[11px]">{modeLabel}</Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-semibold",
                meets
                  ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400"
                  : diff == null
                    ? "bg-muted text-muted-foreground border-muted-foreground/30"
                    : "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400"
              )}
            >
              {result.handbookStatusReason}
            </Badge>
          </div>
        </div>
        <CardTitle className="text-lg leading-snug">{result.courseName}</CardTitle>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-foreground/80">{result.university}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> {result.faculty ?? "Faculty"}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />
            {result.duration ?? (result.degreeDuration != null ? `${result.degreeDuration} years` : "4 Years")}
          </span>
          {result.medium && <span>{result.medium}</span>}
        </div>

        {/* Z-score comparison */}
        {result.officialCutoff != null && diff != null ? (
          <div className="rounded-lg px-3 py-2 text-xs border font-medium bg-muted/40">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-muted-foreground font-normal">Your Z-score</p>
                <p className="font-mono font-semibold">{result.studentZScore}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-normal">Historical cutoff</p>
                <p className="font-mono font-semibold">{result.officialCutoff}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-normal">Difference</p>
                <p className={cn("font-mono font-semibold", diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                  <Target className="h-3 w-3 inline mr-0.5 -mt-0.5" />
                  {diff >= 0 ? `+${diff.toFixed(3)}` : diff.toFixed(3)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg px-3 py-2 text-xs bg-muted/40 border text-muted-foreground">
            Your Z-score <strong className="font-mono">{result.studentZScore}</strong> — no exact district cutoff available
            {(result.estimatedMin != null || result.estimatedMax != null) && (
              <span> (estimated range {result.estimatedMin ?? "?"} - {result.estimatedMax ?? "?"})</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="bg-primary/5 text-xs">Stream: {result.requiredStream}</Badge>
        </div>

        <Button variant="outline" size="sm" className="w-full" onClick={onViewDetails}>
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}

export function CheckerResults({
  response,
  recommendations,
}: {
  response?: CheckerRecommendationsResponse;
  recommendations?: CheckerRecommendationsResponse;
  inputs?: unknown;
}) {
  const { language } = useTranslations();
  const res = response || recommendations;
  const [filterStatus, setFilterStatus] = useState<"eligible" | "non-eligible" | "all">("eligible");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailsFor, setDetailsFor] = useState<CheckerRecommendation | null>(null);

  // Sort by closest distance to the user's entered Z-score (smallest absolute difference first, no-cutoff last)
  const byZScoreCloseness = (a: CheckerRecommendation, b: CheckerRecommendation) => {
    if (a.zscoreDiff == null && b.zscoreDiff == null) return a.courseName.localeCompare(b.courseName);
    if (a.zscoreDiff == null) return 1;
    if (b.zscoreDiff == null) return -1;
    const distA = Math.abs(a.zscoreDiff);
    const distB = Math.abs(b.zscoreDiff);
    if (Math.abs(distA - distB) > 0.0001) return distA - distB;
    if (a.zscoreDiff !== b.zscoreDiff) return b.zscoreDiff - a.zscoreDiff;
    return a.courseName.localeCompare(b.courseName);
  };

  const eligible = useMemo(
    () => [...(res?.groups?.eligible ?? [])].sort(byZScoreCloseness),
    [res],
  );
  const notEligible = useMemo(
    () => [...(res?.groups?.notEligible ?? [])].sort(byZScoreCloseness),
    [res],
  );
  const eligibleCount = eligible.length;
  const nonEligibleCount = notEligible.length;
  const totalCount = eligibleCount + nonEligibleCount;

  // "all" sorts all courses together by closeness to the user's entered Z-score
  const baseList = useMemo<Array<{ result: CheckerRecommendation; group: CheckerResultGroup }>>(() => {
    if (filterStatus === "eligible") return eligible.map((result) => ({ result, group: "eligible" as const }));
    if (filterStatus === "non-eligible") return notEligible.map((result) => ({ result, group: "notEligible" as const }));
    return [
      ...eligible.map((result) => ({ result, group: "eligible" as const })),
      ...notEligible.map((result) => ({ result, group: "notEligible" as const })),
    ].sort((a, b) => byZScoreCloseness(a.result, b.result));
  }, [eligible, notEligible, filterStatus]);

  const displayedResults = useMemo(() => {
    if (!searchQuery.trim()) return baseList;
    const q = searchQuery.toLowerCase();
    const matches = (x: { result: CheckerRecommendation }) =>
      x.result.courseName.toLowerCase().includes(q) ||
      x.result.university.toLowerCase().includes(q) ||
      (x.result.faculty && x.result.faculty.toLowerCase().includes(q));
    const inTab = baseList.filter(matches);
    if (inTab.length > 0) return inTab;
    // Fallback: search across all evaluated courses so results aren't hidden by the active tab
    return [
      ...eligible.map((result) => ({ result, group: "eligible" as const })),
      ...notEligible.map((result) => ({ result, group: "notEligible" as const })),
    ].filter(matches).sort((a, b) => byZScoreCloseness(a.result, b.result));
  }, [baseList, eligible, notEligible, searchQuery]);

  if (!res || !res.groups) {
    return null;
  }

  if (totalCount === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        {language === "si"
          ? "මෙම විෂය ධාරාව සහ වර්ෂය සඳහා පාඨමාලා හමු නොවීය."
          : language === "ta"
            ? "இந்த கல்வியாண்டு மற்றும் பிரிவிற்கு பாடநெறிகள் எதுவும் கிடைக்கவில்லை."
            : "No verified programmes found for this academic year and stream yet."}
      </p>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Header Info Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{res.resultModeLabel}</Badge>
        <Badge variant="outline">{res.academicYear}</Badge>
        <Badge variant="outline">{res.district}</Badge>
      </div>

      <p className="text-sm text-muted-foreground">{res.disclaimer}</p>

      {/* Filter Tabs: Eligible vs Non-Eligible vs All */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-muted/60 rounded-xl border border-[hsl(var(--border))]">
        <div className="flex flex-wrap items-center gap-2">
          {/* ELIGIBLE BUTTON (Default) */}
          <button
            type="button"
            onClick={() => setFilterStatus("eligible")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-xs",
              filterStatus === "eligible"
                ? "bg-card text-emerald-700 dark:text-emerald-300 border-2 border-emerald-500 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Eligible Courses</span>
            <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 font-bold ml-1">
              {eligibleCount}
            </Badge>
          </button>

          {/* NON-ELIGIBLE BUTTON */}
          <button
            type="button"
            onClick={() => setFilterStatus("non-eligible")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-xs",
              filterStatus === "non-eligible"
                ? "bg-card text-red-700 dark:text-red-300 border-2 border-red-500 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span>Non-Eligible</span>
            <Badge variant="secondary" className="bg-red-500/15 text-red-800 dark:text-red-200 font-bold ml-1">
              {nonEligibleCount}
            </Badge>
          </button>

          {/* ALL BUTTON */}
          <button
            type="button"
            onClick={() => setFilterStatus("all")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-xs",
              filterStatus === "all"
                ? "bg-card text-primary border-2 border-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            <span>All</span>
            <Badge variant="secondary" className="font-bold ml-1">
              {totalCount}
            </Badge>
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by course, university, or faculty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-xs bg-card"
          />
        </div>
      </div>

      {/* Filter Status Explanation Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          {filterStatus === "eligible" && (
            <span>
              Showing <strong>{displayedResults.length}</strong> courses that meet handbook requirements —{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                closest to your Z-Score appears first
              </span>
            </span>
          )}
          {filterStatus === "non-eligible" && (
            <span>
              Showing <strong>{displayedResults.length}</strong> courses that do not meet handbook requirements
            </span>
          )}
          {filterStatus === "all" && (
            <span>
              Showing all <strong>{displayedResults.length}</strong> evaluated courses — ranked by closeness to your Z-score
            </span>
          )}
        </div>
      </div>

      {/* Results Grid */}
      {displayedResults.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p>No courses found matching the search criteria.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedResults.map(({ result, group }) => (
            <ResultCard
              key={`${group}-${result.programmeId}`}
              result={result}
              modeLabel={res.resultModeLabel}
              onViewDetails={() => setDetailsFor(result)}
            />
          ))}
        </div>
      )}

      <ResultDetailsModal
        result={detailsFor}
        onClose={() => setDetailsFor(null)}
      />
    </div>
  );
}
