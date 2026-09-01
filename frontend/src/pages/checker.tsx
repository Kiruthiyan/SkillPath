import { useEffect, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { QueryError } from "@/components/query-error";
import { useCheckerRecommendations, useListCheckerAcademicYears } from "@/api";
import { CheckerForm, type CheckerFormValue } from "@/components/checker/checker-form";
import { CheckerResults } from "@/components/checker/checker-results";

const EMPTY_FORM: CheckerFormValue = {
  academicYear: "",
  stream: "",
  district: "Colombo",
  zscore: "",
  subjectGrades: [],
};

export default function Checker() {
  usePageTitle("Z-Score Checker");
  const [form, setForm] = useState<CheckerFormValue>(EMPTY_FORM);
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
    setForm((prev) => ({ ...prev, academicYear: latest.academicYear }));
  }, [academicYears, form.academicYear]);

  const canSubmit = form.academicYear && form.stream && form.district && form.zscore.trim() !== "";

  function handleSubmit() {
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
        <h1 className="text-3xl font-bold tracking-tight">Z-Score &amp; Course Checker</h1>
        <p className="text-muted-foreground mt-2">
          Check course eligibility against verified UGC admissions handbook data. No login required.
        </p>
      </div>

      <Card className="border-secondary/40 bg-secondary/5">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <Info className="h-5 w-5 shrink-0 text-secondary" />
          <p>
            Eligibility is checked in order: stream, then subjects, then grades/special rules, then Z-score,
            using verified handbook data and a rule engine — not AI. Upcoming-year figures are a simple
            recent-year weighted estimate with a variation range, not a guarantee of admission.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-5">
          <CheckerForm value={form} onChange={setForm} />
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Find Matching Courses
          </Button>
        </CardContent>
      </Card>

      {isError && <QueryError onRetry={() => variables && runRecommendations(variables)} />}

      {isPending && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      )}

      {!isPending && recommendations && <CheckerResults response={recommendations} />}
    </div>
  );
}
