import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
import { useProfileStore } from "@/hooks/use-profile";
import { useCheckerRecommendations, useListCheckerAcademicYears } from "@/api";
import { CheckerForm, type CheckerFormValue } from "@/components/checker/checker-form";
import { CheckerResults } from "@/components/checker/checker-results";

export default function Checker() {
  const { t } = useTranslations();
  usePageTitle(t.checker.title);
  const profile = useProfileStore();

  const [form, setForm] = useState<CheckerFormValue>(() => ({
    academicYear: "",
    stream: profile.stream || "Physical Science",
    district: profile.district || "Colombo",
    zscore: profile.zscore != null ? String(profile.zscore) : "",
    subjectGrades: [],
  }));

  const { data: academicYears } = useListCheckerAcademicYears();
  const {
    mutate: runRecommendations,
    data: recommendations,
    isPending,
    isError,
    variables,
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

  const canSubmit = Boolean(form.academicYear && form.stream && form.district && form.zscore.trim() !== "");

  function handleSubmit() {
    if (!canSubmit) return;
    const subjectGrades: Record<string, string> = {};
    for (const row of form.subjectGrades) {
      if (row.subject && row.grade) subjectGrades[row.subject] = row.grade;
    }
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
          <p>{t.checker.notice}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-5">
          <CheckerForm value={form} onChange={setForm} />
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending} className="w-full sm:w-auto">
            {isPending ? t.actions.saving : t.checker.checkBtn}
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
        <CheckerResults response={recommendations} />
      )}
    </div>
  );
}
