import { Link } from "wouter";
import {
  useGetDashboardStats,
  useGetRecommendations,
  useListSavedCourses,
  useListSavedUniversities,
  useListRoadmaps,
  useListRecentSearches,
  getGetRecommendationsQueryKey,
} from "@/api";
import {
  GraduationCap,
  BookOpen,
  Star,
  Trophy,
  ChevronRight,
  TrendingUp,
  Building2,
  AlertCircle,
  Bookmark,
  Search,
  Map as MapIcon,
} from "lucide-react";
import { useProfileStore } from "@/hooks/use-profile";
import { useAuthStore } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { t } = useTranslations();
  usePageTitle(t.dashboard.title);
  const profile = useProfileStore();
  const user = useAuthStore((s) => s.user);
  const isComplete = profile.isComplete() || !!(user?.stream && user?.zscore != null);

  const stream = profile.stream || user?.stream || undefined;
  const zscore = profile.zscore ?? user?.zscore ?? undefined;
  const district = profile.district || user?.district || "Colombo";

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } =
    useGetDashboardStats();
  const { data: recommendations, isLoading: recsLoading } = useGetRecommendations(
    { stream, zscore, district, yearMode: "predicted" },
    {
      query: {
        queryKey: getGetRecommendationsQueryKey({ stream, zscore, district, yearMode: "predicted" }),
        enabled: isComplete,
      },
    },
  );
  const { data: savedCourses } = useListSavedCourses();
  const { data: savedUniversities } = useListSavedUniversities();
  const { data: roadmaps } = useListRoadmaps();
  const { data: recentSearches } = useListRecentSearches();

  const statCards = [
    { label: t.dashboard.statUniversities, value: stats?.totalUniversities, icon: Building2 },
    { label: t.dashboard.statCourses, value: stats?.totalCourses, icon: BookOpen },
    { label: t.dashboard.statReviews, value: stats?.totalReviews, icon: Star },
    { label: t.dashboard.statStories, value: stats?.totalSuccessStories, icon: Trophy },
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.dashboard.title}</h1>
          <p className="text-muted-foreground mt-2">
            {user ? `${t.dashboard.welcomeBack}, ${user.name}` : t.dashboard.overviewSubtitle}
          </p>
        </div>
        {stats?.handbookYear && (
          <Badge variant="outline">{t.dashboard.handbookBadge} {stats.handbookYear}</Badge>
        )}
      </div>

      {statsError && <QueryError onRetry={() => refetchStats()} />}

      {!isComplete && (
        <Card className="border-secondary/50 bg-secondary/5">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertCircle className="h-8 w-8 text-secondary shrink-0" />
            <div className="flex-1">
              <p className="font-medium">{t.dashboard.profileAlertTitle}</p>
              <p className="text-sm text-muted-foreground">{t.dashboard.profileAlertDesc}</p>
            </div>
            <Button asChild><Link href="/profile">{t.actions.setUpProfile}</Link></Button>
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">{value ?? 0}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {stats?.topStreams && stats.topStreams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.topStreamsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {stats.topStreams.map((s) => (
              <Badge key={s.stream} variant="secondary">
                {s.stream}: {s.courseCount}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {isComplete && (
        <>
          {recommendations?.disclaimer && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 text-sm text-muted-foreground">
                {recommendations.disclaimer}
                {recommendations.handbookAttribution && (
                  <span className="block mt-1">{recommendations.handbookAttribution}</span>
                )}
              </CardContent>
            </Card>
          )}

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                {t.dashboard.recommendedTitle}
              </CardTitle>
              <CardDescription>
                {t.dashboard.recommendedSubtitle}
                {recommendations?.predictedYear && (
                  <> · Predicted {recommendations.predictedYear}</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recsLoading ? (
                <Skeleton className="h-24" />
              ) : recommendations?.courses?.length ? (
                recommendations.courses.slice(0, 4).map((course) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--border))] hover:border-primary/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{course.degreeName}</p>
                      <p className="text-sm text-muted-foreground">{course.universityName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {course.eligibility && (
                        <Badge variant="outline">{course.eligibility}</Badge>
                      )}
                      {course.matchScore && <Badge variant="secondary">{course.matchScore}</Badge>}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">{t.dashboard.noRecommendations}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t.dashboard.careerPathsTitle}
              </CardTitle>
              <CardDescription>{t.dashboard.careerPathsSubtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recsLoading ? (
                <Skeleton className="h-24" />
              ) : recommendations?.careers?.length ? (
                recommendations.careers.slice(0, 4).map((career) => (
                  <div key={career.id} className="p-3 rounded-lg border border-[hsl(var(--border))]">
                    <p className="font-medium">{career.title}</p>
                    <p className="text-sm text-muted-foreground">
                      LKR {career.salaryMin.toLocaleString()} – {career.salaryMax.toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">{t.dashboard.noCareers}</p>
              )}
            </CardContent>
          </Card>
        </div>
        </>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bookmark className="h-4 w-4" /> {t.dashboard.savedCoursesTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedCourses?.length ? (
              savedCourses.slice(0, 3).map((c) => (
                <Link key={c.id} href={`/courses/${c.id}`} className="block text-sm hover:text-primary">
                  {c.degreeName}
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t.dashboard.noSavedCourses}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> {t.dashboard.savedUniversitiesTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedUniversities?.length ? (
              savedUniversities.slice(0, 3).map((u) => (
                <Link key={u.id} href={`/universities/${u.id}`} className="block text-sm hover:text-primary">
                  {u.name}
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t.dashboard.noSavedUniversities}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapIcon className="h-4 w-4" /> {t.dashboard.roadmapsTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roadmaps?.length ? (
              roadmaps.slice(0, 3).map((r) => (
                <Link
                  key={r.id}
                  href={`/roadmap?courseId=${r.courseId}`}
                  className="block text-sm hover:text-primary"
                >
                  {r.degreeName}
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t.dashboard.noRoadmaps}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {recentSearches && recentSearches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" /> {t.dashboard.recentSearchesTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {recentSearches.map((s) => (
              <Badge key={s.id} variant="outline">{s.query}</Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
