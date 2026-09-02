import { useState, useMemo } from "react";
import { BookOpen, Building2, CheckCircle2, GraduationCap, Search, Sparkles, Target, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  CheckerRecommendation,
  CheckerRecommendationsResponse,
  CheckerResultGroup,
} from "@/api";

const GROUP_CLASS_NAMES: Record<CheckerResultGroup, string> = {
  competitiveOptions: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-400",
  strongMatches: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  nearHistoricalRange: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  notEligible: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
};

const GROUPS: CheckerResultGroup[] = [
  "competitiveOptions",
  "strongMatches",
  "nearHistoricalRange",
  "notEligible",
];

function getEffectiveCutoff(rec: CheckerRecommendation): number | null {
  if (rec.officialCutoff != null) return rec.officialCutoff;
  if (rec.estimatedCenter != null) return rec.estimatedCenter;
  if (rec.estimatedMin != null && rec.estimatedMax != null) {
    return (rec.estimatedMin + rec.estimatedMax) / 2;
  }
  return null;
}

function ResultCard({
  result,
  modeLabel,
  group,
}: {
  result: CheckerRecommendation;
  modeLabel: string;
  group: CheckerResultGroup;
}) {
  const isEligible = group === "competitiveOptions" || group === "strongMatches";
  const ReasonIcon = isEligible ? CheckCircle2 : XCircle;
  const reasonIconClass = isEligible ? "text-emerald-600 dark:text-emerald-400" : "text-red-500";

  const cutoff = getEffectiveCutoff(result);
  const diff = cutoff != null ? result.studentZScore - cutoff : null;
  const absDiff = diff != null ? Math.abs(diff) : null;

  return (
    <Card className={cn(
      "transition-all hover:shadow-md border",
      isEligible
        ? group === "competitiveOptions"
          ? "hover:border-blue-500/50 border-blue-500/20"
          : "hover:border-emerald-500/50 border-emerald-500/20"
        : group === "nearHistoricalRange"
          ? "hover:border-amber-500/50 border-amber-500/20"
          : "hover:border-red-500/40 border-[hsl(var(--border))]"
    )}>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <GraduationCap className={cn(
            "h-6 w-6 shrink-0",
            isEligible ? "text-primary" : "text-muted-foreground"
          )} />
          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            <Badge variant="outline" className="text-[11px]">{modeLabel}</Badge>
            <Badge variant="outline" className={cn("text-xs font-semibold", GROUP_CLASS_NAMES[group])}>
              {group === "competitiveOptions" && "Top Close Match"}
              {group === "strongMatches" && "Strong / Safe Match"}
              {group === "nearHistoricalRange" && "Near Range (Reach)"}
              {group === "notEligible" && "Not Eligible"}
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
        {/* Proximity / Match Banner */}
        {cutoff != null && diff != null ? (
          <div
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-xs border font-medium",
              diff >= 0
                ? diff <= 0.1
                  ? "bg-blue-500/10 text-blue-900 dark:text-blue-300 border-blue-500/30"
                  : "bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 border-emerald-500/30"
                : diff >= -0.15
                  ? "bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/30"
                  : "bg-red-500/10 text-red-900 dark:text-red-300 border-red-500/30"
            )}
          >
            <span className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 shrink-0" />
              <span>Cutoff: <strong className="font-mono text-xs">{cutoff.toFixed(4)}</strong></span>
            </span>
            <span className="font-semibold text-right">
              {diff >= 0 ? (
                <span>+{diff.toFixed(3)} <span className="opacity-80">(Qualified)</span></span>
              ) : (
                <span>{diff.toFixed(3)} <span className="opacity-80">(Gap)</span></span>
              )}
              {absDiff != null && absDiff <= 0.05 && " ⭐"}
            </span>
          </div>
        ) : (
          <div className="rounded-lg px-3 py-2 text-xs bg-muted/50 border text-muted-foreground">
            No exact district cutoff available
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-xs">{result.faculty ?? "Faculty"}</Badge>
          <Badge variant="outline" className="text-xs">
            {result.duration ?? (result.degreeDuration != null ? `${result.degreeDuration} years` : "4 Years")}
          </Badge>
          {result.medium && <Badge variant="outline" className="text-xs">{result.medium}</Badge>}
          <Badge variant="outline" className="bg-primary/5 text-xs">{result.requiredStream}</Badge>
        </div>

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

        <div className="grid gap-1 text-xs pt-1 border-t border-[hsl(var(--border))]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Your Z-score:</span>
            <span className="font-medium font-mono">{result.studentZScore}</span>
          </div>
          {result.officialCutoff != null ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Official cutoff:</span>
              <span className="font-medium font-mono">{result.officialCutoff}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estimated range:</span>
              <span className="font-medium font-mono">
                {result.estimatedMin ?? "?"} - {result.estimatedMax ?? "?"}
              </span>
            </div>
          )}
          {result.confidence && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Confidence:</span>
              <span className="font-medium">{result.confidence}</span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground pt-0.5">
          <BookOpen className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="line-clamp-1">
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
  const [filterStatus, setFilterStatus] = useState<"eligible" | "non-eligible" | "engineering-ai" | "all">("eligible");
  const [searchQuery, setSearchQuery] = useState("");

  const isEngineeringOrAi = (name: string) =>
    /engineering|artificial intelligence|\bai\b|intelligent systems/i.test(name);

  const allItemsWithMeta = useMemo(() => {
    if (!res || !res.groups) return [];
    const items: Array<{
      result: CheckerRecommendation;
      group: CheckerResultGroup;
      isEligible: boolean;
      distance: number;
      cutoff: number | null;
    }> = [];

    for (const group of GROUPS) {
      const list = res.groups[group] || [];
      const isEligible = group === "competitiveOptions" || group === "strongMatches";
      for (const result of list) {
        const cutoff = getEffectiveCutoff(result);
        const distance = cutoff != null ? Math.abs(result.studentZScore - cutoff) : Number.POSITIVE_INFINITY;
        items.push({ result, group, isEligible, distance, cutoff });
      }
    }

    return items;
  }, [res]);

  const eligibleCount = useMemo(
    () => allItemsWithMeta.filter((x) => x.isEligible).length,
    [allItemsWithMeta]
  );
  const nonEligibleCount = useMemo(
    () => allItemsWithMeta.filter((x) => !x.isEligible).length,
    [allItemsWithMeta]
  );
  const engineeringAiItems = useMemo(
    () => allItemsWithMeta.filter((x) => isEngineeringOrAi(x.result.courseName)),
    [allItemsWithMeta]
  );
  const engineeringAiCount = engineeringAiItems.length;
  const totalCount = allItemsWithMeta.length;

  // Filtered and sorted list based on active tab and search
  const displayedResults = useMemo(() => {
    let filtered = allItemsWithMeta;

    if (filterStatus === "eligible") {
      filtered = filtered.filter((x) => x.isEligible);
      // For eligible courses: most matching (closest cutoff to student score) appears FIRST!
      filtered.sort((a, b) => {
        if (a.distance !== b.distance) {
          return a.distance - b.distance;
        }
        // If same distance, highest cutoff first
        const cutA = a.cutoff ?? -Infinity;
        const cutB = b.cutoff ?? -Infinity;
        if (cutA !== cutB) return cutB - cutA;
        return a.result.courseName.localeCompare(b.result.courseName);
      });
    } else if (filterStatus === "non-eligible") {
      filtered = filtered.filter((x) => !x.isEligible);
      // For non-eligible: closest reach courses (smallest gap to cutoff) appear FIRST!
      filtered.sort((a, b) => {
        if (a.distance !== b.distance) {
          return a.distance - b.distance;
        }
        return a.result.courseName.localeCompare(b.result.courseName);
      });
    } else if (filterStatus === "engineering-ai") {
      filtered = engineeringAiItems;
      // Sort by closest distance to student score
      filtered = [...filtered].sort((a, b) => {
        if (a.distance !== b.distance) {
          return a.distance - b.distance;
        }
        return a.result.courseName.localeCompare(b.result.courseName);
      });
    } else {
      // All courses: closest distance overall appears FIRST
      filtered = [...filtered].sort((a, b) => {
        if (a.distance !== b.distance) {
          return a.distance - b.distance;
        }
        return a.result.courseName.localeCompare(b.result.courseName);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inTab = filtered.filter(
        (x) =>
          x.result.courseName.toLowerCase().includes(q) ||
          x.result.university.toLowerCase().includes(q) ||
          (x.result.faculty && x.result.faculty.toLowerCase().includes(q))
      );
      if (inTab.length > 0) {
        return inTab;
      }
      // Fallback: search across all evaluated courses so courses like AI or Engineering are never missing
      return allItemsWithMeta.filter(
        (x) =>
          x.result.courseName.toLowerCase().includes(q) ||
          x.result.university.toLowerCase().includes(q) ||
          (x.result.faculty && x.result.faculty.toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [allItemsWithMeta, engineeringAiItems, filterStatus, searchQuery]);

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

      {/* 1st Prominent Filter: Eligible vs Non-Eligible vs Engineering & AI vs All */}
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

          {/* ENGINEERING & AI FOCUS BUTTON */}
          <button
            type="button"
            onClick={() => setFilterStatus("engineering-ai")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-xs",
              filterStatus === "engineering-ai"
                ? "bg-card text-indigo-700 dark:text-indigo-300 border-2 border-indigo-500 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Engineering & AI</span>
            <Badge variant="secondary" className="bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 font-bold ml-1">
              {engineeringAiCount}
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
            <span>Non-Eligible / Reach</span>
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
            placeholder="Search Engineering, AI, course..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-xs bg-card"
          />
        </div>
      </div>

      {/* Engineering & AI Quick Overview Alert when on Eligible tab */}
      {filterStatus === "eligible" && engineeringAiCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-xl text-xs text-indigo-950 dark:text-indigo-200">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              <strong>Looking for Engineering or Artificial Intelligence?</strong>{" "}
              {engineeringAiCount} programmes evaluated (including Moratuwa, Peradeniya, USJ, Ruhuna, and SEUSL).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFilterStatus("engineering-ai")}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors shrink-0"
          >
            View Engineering & AI ({engineeringAiCount})
          </button>
        </div>
      )}

      {/* Filter Status Explanation Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          {filterStatus === "eligible" && (
            <span>
              Showing <strong>{displayedResults.length}</strong> eligible courses —{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                most matching courses closest to your Z-Score appear first
              </span>
            </span>
          )}
          {filterStatus === "engineering-ai" && (
            <span>
              Showing all <strong>{displayedResults.length}</strong> Engineering and AI programmes ranked by closest cutoff to your score
            </span>
          )}
          {filterStatus === "non-eligible" && (
            <span>
              Showing <strong>{displayedResults.length}</strong> non-eligible courses —{" "}
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                closest reach targets appear first
              </span>
            </span>
          )}
          {filterStatus === "all" && (
            <span>
              Showing all <strong>{displayedResults.length}</strong> courses ranked by nearest Z-score distance
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
              group={group}
            />
          ))}
        </div>
      )}
    </div>
  );
}
