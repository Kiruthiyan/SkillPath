import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Clock,
  GraduationCap,
  Info,
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
  const courseId = parseInt(params.id ?? "0");
  const profile = useProfileStore();
  const district = profile.district || "Colombo";
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
                <Badge>{course.uniCode}</Badge>
                {course.eligibleStreams?.map((stream) => (
                  <Badge key={stream} variant="outline">{stream}</Badge>
                ))}
                <Badge variant="outline">
                  {course.minimumZScore != null
                    ? `${t.courses.districtCutoff}: ${course.minimumZScore}${course.officialAcademicYear ? ` (${course.officialAcademicYear})` : ""}`
                    : "Cutoff not mapped"}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold">{course.degreeName}</h1>
              <p className="text-muted-foreground mt-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0" />
                <Link href={`/universities/${course.universityId}`} className="hover:text-primary">
                  {course.universityName}
                </Link>
                <Badge variant="outline" className="text-xs font-normal">{district} quota</Badge>
              </p>
            </div>

            <Card className="border-secondary/40 bg-secondary/5">
              <CardContent className="flex gap-2 p-4 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                Data from official handbook-derived local records.
              </CardContent>
            </Card>

            {course.cutoffHistory && course.cutoffHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t.courses.cutoffHistory} ({district})</CardTitle>
                  <CardDescription>Official handbook minimum Z-scores by year</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {course.cutoffHistory.map((point) => (
                      <div
                        key={point.academicYear}
                        className="flex justify-between items-center py-2 border-b border-[hsl(var(--border))] last:border-0"
                      >
                        <span className="text-sm font-medium">{point.academicYear}</span>
                        <span className="font-mono font-semibold">{point.minimumZScore.toFixed(3)}</span>
                      </div>
                    ))}
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

            {course.subjects.length > 0 && (
              <Card>
                <CardHeader><CardTitle>A/L Subjects</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {course.subjects.map((subject) => (
                      <Badge key={subject} variant="secondary">{subject}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {course.minimumGrades && course.minimumGrades.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Minimum Grade Requirements</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {course.minimumGrades.map((rule) => (
                      <Badge key={rule} variant="outline">{rule}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {course.specialRequirements && course.specialRequirements.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Special Requirements</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {course.specialRequirements.map((rule) => (
                      <li key={rule}>• {rule}</li>
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
