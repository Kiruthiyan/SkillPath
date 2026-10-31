import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
import { useProfileStore } from "@/hooks/use-profile";
import { useCheckerRecommendations, useListCheckerAcademicYears } from "@/api";
import { CheckerForm, type CheckerFormValue } from "@/components/checker/checker-form";
import { CheckerResults } from "@/components/checker/checker-results";

/**
 * Validates the Z-score string entered by the user.
 * Returns null if valid, or an error/warning string if not.
 * Hard reject: non-numeric, NaN, Infinity.
 * Soft warn: values far outside the plausible observed range (0.0 – 3.0).
 * We do NOT invent a hard cap because no universal UGC-source bound is verified;
 * we only flag values that are clearly implausible.
 */
function validateZscore(raw: string): { error: string | null; warning: string | null } {
  const trimmed = raw.trim();
  if (trimmed === "") return { error: null, warning: null };

  const value = Number(trimmed);
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return { error: "Z-score must be a real, finite number (e.g. 1.850).", warning: null };
  }

  // Soft warning for clearly implausible values outside the observed range of
  // official UGC cutoff data (approximately 0.0–3.0). This is NOT a hard rule —
  // we are not aware of a UGC-source-verified universal bound.
  if (value < 0.0 || value > 3.0) {
    return {
      error: null,
      warning: `Z-score ${value} is outside the plausible range (0.0–3.0) seen in official UGC data. Double-check your value.`,
    };
  }

  return { error: null, warning: null };
}

export default function Checker() {
  const { t } = useTranslations();
  usePageTitle(t.checker.title);
  const profile = useProfileStore();

  const [form, setForm] = useState<CheckerFormValue>(() => ({
    academicYear: "",
    stream: profile.stream || "",
    district: profile.district || "",
    zscore: profile.zscore != null ? String(profile.zscore) : "",
    subjectGrades: [],
  }));

  // Track whether displayed results are stale (i.e. inputs changed since last submit)
  const [resultsStale, setResultsStale] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: academicYears } = useListCheckerAcademicYears();
  const {
    mutate: runRecommendations,
    data: recommendations,
    isPending,
    isError,
  } = useCheckerRecommendations();

  useEffect(() => {
    if (form.academicYear || !academicYears?.length) return;
    const officialYears = academicYears.filter((year) => year.handbookAvailable);
    const latest = [...(officialYears.length > 0 ? officialYears : academicYears)].sort((a, b) =>
      b.academicYear.localeCompare(a.academicYear),
    )[0];
    if (latest) {
      setForm((prev) => ({ ...prev, academicYear: latest.academicYear }));
    }
  }, [academicYears, form.academicYear]);

  // Mark results stale whenever any input changes after a result has been shown
  const handleFormChange = useCallback((newForm: CheckerFormValue) => {
    setForm(newForm);
    if (recommendations) setResultsStale(true);
    setSubmitError(null);
  }, [recommendations]);

  const zscoreValidation = validateZscore(form.zscore);
  const canSubmit = Boolean(
    form.academicYear &&
    form.stream &&
    form.district &&
    form.zscore.trim() !== "" &&
    !zscoreValidation.error,
  );

  function handleSubmit() {
    if (!canSubmit) return;

    // Validate Z-score at the data-processing boundary (client-side trust boundary)
    const zv = validateZscore(form.zscore);
    if (zv.error) {
      setSubmitError(zv.error);
      return;
    }

    // Build subjectGrades record — enforce no duplicates.
    // If the user added the same subject twice, only the last grade is kept
    // and a warning is shown rather than silently accepting invalid input.
    const subjectGrades: Record<string, string> = {};
    const seenSubjects = new Set<string>();
    let hasDuplicates = false;
    for (const row of form.subjectGrades) {
      if (row.subject && row.grade) {
        if (seenSubjects.has(row.subject)) {
          hasDuplicates = true;
        }
        seenSubjects.add(row.subject);
        subjectGrades[row.subject] = row.grade;
      }
    }

    if (hasDuplicates) {
      setSubmitError(
        "Duplicate subjects detected. Each subject may only be entered once. Please remove duplicate entries.",
      );
      return;
    }

    setSubmitError(null);
    setResultsStale(false);
    runRecommendations({
      academicYear: form.academicYear,
      stream: form.stream,
      district: form.district,
      zscore: Number(form.zscore),
      subjectGrades,
    });
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.checker.title}</h1>
        <p className="text-muted-foreground mt-2">
          {t.checker.subtitle}
        </p>
      </div>

      <Card className="border-secondary/40 bg-secondary/5">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <Info className="h-5 w-5 shrink-0 text-secondary" />
          <p>
            {t.checker.notice}{" "}
            <strong>
              Data source: UGC Admissions Handbook (official cutoff data from the 2024/25 edition).
              Results are estimates only — not an admission guarantee. Official UGC sources prevail.
            </strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-5">
          <CheckerForm value={form} onChange={handleFormChange} />

          {/* Z-score soft warning */}
          {zscoreValidation.warning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              <span>{zscoreValidation.warning}</span>
            </div>
          )}

          {/* Z-score hard error */}
          {zscoreValidation.error && form.zscore.trim() !== "" && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{zscoreValidation.error}</span>
            </div>
          )}

          {/* Submit/duplicate error */}
          {submitError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={!canSubmit || isPending} className="w-full sm:w-auto">
            {isPending ? t.actions.processing : t.checker.checkBtn}
          </Button>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Failed to evaluate course recommendations. Please verify your inputs and try again.
          </CardContent>
        </Card>
      )}

      {recommendations && (
        <div className="relative">
          {/* Stale results overlay/banner */}
          {resultsStale && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
              <span>
                <strong>Results may be outdated.</strong> Your inputs have changed since the last check.
                Click &ldquo;{t.checker.checkBtn}&rdquo; to refresh results.
              </span>
            </div>
          )}
          <CheckerResults response={recommendations} />
        </div>
      )}
    </div>
  );
}
