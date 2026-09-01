import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Clock,
  GraduationCap,
  Map,
  Star,
  Sparkles,
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
import { QueryError } from "@/components/query-error";
import { BookmarkCourseButton } from "@/components/bookmark-course-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function CourseDetail() {
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

  usePageTitle(course?.degreeName);

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
        <h2 className="text-2xl font-bold mb-4">Course not found</h2>
        <Button asChild><Link href="/courses">Back to Courses</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/courses"><ArrowLeft className="h-4 w-4 mr-2" /> All Courses</Link>
      </Button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge>{course.degreeType}</Badge>
                <Badge variant="outline">{course.stream}</Badge>
                <Badge variant="outline">
                  Min Z: {course.minimumZScore}
                  {course.predictedAcademicYear && ` (predicted ${course.predictedAcademicYear})`}
                </Badge>
                {course.officialMinimumZScore != null && (
                  <Badge variant="outline">
                    Official {course.officialAcademicYear}: {course.officialMinimumZScore}
                  </Badge>
                )}
                {course.confidence && (
                  <Badge variant="secondary">{course.confidence} confidence</Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold">{course.degreeName}</h1>
              <p className="text-muted-foreground mt-2 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <Link href={`/universities/${course.universityId}`} className="hover:text-primary">
                  {course.universityName}
                </Link>
                · {course.faculty} · {district} quota
              </p>
            </div>

            <Card className="border-secondary/40 bg-secondary/5">
              <CardContent className="flex gap-2 p-4 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                Data from UGC University Admissions Handbook. Predictions are statistical estimates.
              </CardContent>
            </Card>

            {course.cutoffHistory && course.cutoffHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Historical Cutoffs ({district})</CardTitle>
                  <CardDescription>Official UGC handbook minimum Z-scores by year</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {course.cutoffHistory.map((point) => (
                      <div
                        key={point.academicYear}
                        className="flex justify-between items-center py-2 border-b border-[hsl(var(--border))] last:border-0"
                      >
                        <span className="text-sm font-medium">{point.academicYear}</span>
                        <span className="font-mono">{point.minimumZScore.toFixed(3)}</span>
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
                    <Sparkles className="h-5 w-5 text-primary" />
                    AI Prediction Insight
                  </CardTitle>
                  <CardDescription>{insight?.handbookAttribution}</CardDescription>
                </CardHeader>
                <CardContent>
                  {insightLoading ? (
                    <Skeleton className="h-20" />
                  ) : insight?.explanation ? (
                    <p className="text-muted-foreground leading-relaxed">{insight.explanation}</p>
                  ) : (
                    <p className="text-muted-foreground text-sm">Unable to load insight.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {course.description && (
              <Card>
                <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{course.description}</p>
                </CardContent>
              </Card>
            )}

            {course.subjects.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Subjects</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {course.subjects.map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {course.skillsDeveloped.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Skills Developed</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {course.skillsDeveloped.map((s) => (
                      <Badge key={s} variant="outline">{s}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {course.durationYears} years
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  {course.faculty}
                </div>
                {university && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Rank #{university.ranking}
                  </div>
                )}
                <Button variant="secondary" className="w-full" onClick={handleAskAi}>
                  <Sparkles className="h-4 w-4 mr-2" /> Ask AI Why
                </Button>
                <BookmarkCourseButton courseId={course.id} className="w-full" size="default" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Explore Further</CardTitle>
                <CardDescription>Related pages for this degree</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/careers?degreeType=${encodeURIComponent(course.degreeType)}`}>
                    <GraduationCap className="h-4 w-4 mr-2" /> Career Paths
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/roadmap?courseId=${course.id}`}>
                    <Map className="h-4 w-4 mr-2" /> Generate Roadmap
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href={`/reviews?courseId=${course.id}`}>
                    <Star className="h-4 w-4 mr-2" /> Alumni Reviews
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
