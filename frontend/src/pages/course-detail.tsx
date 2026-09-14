import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  GraduationCap,
  Info,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  useGetCourse,
  useGetCoursePredictionInsight,
  useGetUniversity,
  getGetCourseQueryKey,
  getGetUniversityQueryKey,
  getGetCoursePredictionInsightQueryKey,
} from "@/api";
import { useProfileStore } from "@/hooks/use-profile";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function displayMedium(medium: string | string[] | null | undefined): string | null {
  if (Array.isArray(medium)) return medium.join(" / ");
  return medium ?? null;
}

export default function CourseDetail() {
  const { t } = useTranslations();
  const params = useParams();
  const parsedId = parseInt(params.id ?? "0", 10);
  const courseId = Number.isNaN(parsedId) ? 0 : parsedId;
  const profile = useProfileStore();
  const district = profile.district || undefined;
  const [showInsight, setShowInsight] = useState(false);

  const { data: course, isLoading, isError, refetch } = useGetCourse(
    courseId,
    { district, yearMode: "predicted" },
    {
      query: {
        queryKey: [...getGetCourseQueryKey(courseId), district, "predicted"],
        enabled: courseId > 0,
      },
    },
  );
  const { data: university } = useGetUniversity(course?.universityId ?? 0, {
    query: {
      queryKey: getGetUniversityQueryKey(course?.universityId ?? 0),
      enabled: !!course?.universityId,
    },
  });

  const insightParams = { district, zscore: profile.zscore ?? undefined };
  const { data: insight, isLoading: insightLoading, refetch: fetchInsight } =
    useGetCoursePredictionInsight(
      courseId,
      insightParams,
      {
        query: {
          queryKey: getGetCoursePredictionInsightQueryKey(courseId, insightParams),
          enabled: false,
        },
      },
    );

  usePageTitle(course?.degreeName ?? t.courses.courseDetails);

  async function handleAskAi() {
    setShowInsight(true);
    await fetchInsight();
  }

  if (courseId <= 0) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">{t.courses.noCoursesFound}</h2>
        <Button asChild><Link href="/courses">{t.courses.backToCourses}</Link></Button>
      </div>
    );
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (isError) {
    return <QueryError onRetry={() => refetch()} />;
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">{t.courses.noCoursesFound}</h2>
        <Button asChild><Link href="/courses">{t.courses.backToCourses}</Link></Button>
      </div>
    );
  }

  const validCutoffHistory = Array.isArray(course.cutoffHistory)
    ? course.cutoffHistory.filter(
        (point) => point && typeof point.minimumZScore === "number" && !Number.isNaN(point.minimumZScore)
      )
    : [];

  const subjects = Array.isArray(course.subjects) ? course.subjects : [];
  const minimumGrades = Array.isArray(course.minimumGrades) ? course.minimumGrades : [];
  const specialRequirements = Array.isArray(course.specialRequirements) ? course.specialRequirements : [];
  const eligibleStreams = Array.isArray(course.eligibleStreams) ? course.eligibleStreams : [];

  return (
    <div className="space-y-8 pb-10">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/courses"><ArrowLeft className="h-4 w-4 mr-2" /> {t.courses.backToCourses}</Link>
      </Button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                {course.uniCode && <Badge>{course.uniCode}</Badge>}
                {eligibleStreams.map((stream, idx) => (
                  <Badge key={`${stream}-${idx}`} variant="outline">{stream}</Badge>
                ))}
                <Badge variant="outline">
                  {typeof course.minimumZScore === "number" && !Number.isNaN(course.minimumZScore)
                    ? `${t.courses.districtCutoff}: ${course.minimumZScore.toFixed(4)}${course.officialAcademicYear ? ` (${course.officialAcademicYear})` : ""}`
                    : "Cutoff not mapped"}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold">{course.degreeName ?? "Course Details"}</h1>
              <p className="text-muted-foreground mt-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0" />
                {course.universityId ? (
                  <Link href={`/universities/${course.universityId}`} className="hover:text-primary">
                    {course.universityName ?? "University"}
                  </Link>
                ) : (
                  <span>{course.universityName ?? "University"}</span>
                )}
                <Badge variant="outline" className="text-xs font-normal">{district} quota</Badge>
              </p>
            </div>

            <Card className="border-secondary/40 bg-secondary/5">
              <CardContent className="flex gap-2 p-4 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                Data from official handbook-derived local records.
              </CardContent>
            </Card>

            {validCutoffHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      {t.courses.cutoffHistory} ({district})
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {validCutoffHistory.length} Years of Handbook Data
                    </Badge>
                  </div>
                  <CardDescription>Official minimum Z-score cutoffs published in university admissions handbooks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] bg-card">
                    {validCutoffHistory.map((point, index) => {
                      const nextPoint = validCutoffHistory[index + 1];
                      const diff =
                        nextPoint != null &&
                        typeof nextPoint.minimumZScore === "number" &&
                        typeof point.minimumZScore === "number"
                          ? point.minimumZScore - nextPoint.minimumZScore
                          : null;

                      return (
                        <div
                          key={`${point.academicYear}-${index}`}
                          className="flex justify-between items-center px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{point.academicYear}</span>
                            {index === 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                                Latest
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            {diff != null && !Number.isNaN(diff) && (
                              <span
                                className={`text-xs flex items-center font-mono ${
                                  diff > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : diff < 0
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-muted-foreground"
                                }`}
                                title={`Change from ${nextPoint?.academicYear}: ${diff > 0 ? "+" : ""}${diff.toFixed(4)}`}
                              >
                                {diff > 0 ? (
                                  <TrendingUp className="h-3.5 w-3.5 mr-0.5 inline" />
                                ) : diff < 0 ? (
                                  <TrendingDown className="h-3.5 w-3.5 mr-0.5 inline" />
                                ) : (
                                  <Minus className="h-3.5 w-3.5 mr-0.5 inline" />
                                )}
                                {diff > 0 ? "+" : ""}
                                {diff.toFixed(4)}
                              </span>
                            )}
                            <span className="font-mono font-bold text-base text-foreground">
                              {point.minimumZScore.toFixed(4)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {showInsight && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" />
                    {t.courses.aiPrediction}
                  </CardTitle>
                  <CardDescription>{insight?.handbookAttribution}</CardDescription>
                </CardHeader>
                <CardContent>
                  {insightLoading ? (
                    <Skeleton className="h-20" />
                  ) : insight?.explanation ? (
                    <p className="text-muted-foreground leading-relaxed">{insight.explanation}</p>
                  ) : (
                    <p className="text-muted-foreground text-sm">Unable to load note.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {subjects.length > 0 && (
              <Card>
                <CardHeader><CardTitle>A/L Subjects</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((subject, idx) => (
                      <Badge key={`${subject}-${idx}`} variant="secondary">{subject}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {minimumGrades.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Minimum Grade Requirements</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {minimumGrades.map((rule, idx) => (
                      <Badge key={`${rule}-${idx}`} variant="outline">{rule}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {specialRequirements.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Special Requirements</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {specialRequirements.map((rule, idx) => (
                      <li key={`${rule}-${idx}`}>• {rule}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{t.courses.duration}: {course.duration ?? "4 Years"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span>{course.faculty ?? "Faculty"}</span>
                </div>
                {displayMedium(course.medium) && (
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <span>{t.courses.medium}: {displayMedium(course.medium)}</span>
                  </div>
                )}
                {course.intake != null && (
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <span>Intake: {course.intake} seats</span>
                  </div>
                )}
                {university && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{university.courseCount ?? 0} {t.universities.officialCourses}</span>
                  </div>
                )}
                <Button variant="secondary" className="w-full" onClick={handleAskAi}>
                  <Info className="h-4 w-4 mr-2" /> {t.courses.getPrediction}
                </Button>
                <Button variant="default" className="w-full" asChild>
                  <Link href={`/roadmap?courseId=${course.id}`}>
                    {t.courses.generateCareerRoadmap}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
