import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDashboardStats,
  useGetRecommendations,
  useListSavedCourses,
  useListSavedUniversities,
  useListRoadmaps,
  useListRecentSearches,
  getGetRecommendationsQueryKey,
  getListRecentSearchesQueryKey,
  customFetch,
} from "@/api";
import {
  GraduationCap,
  Briefcase,
  Bot,
  Map as MapIcon,
  ChevronRight,
  ArrowRight,
  Building2,
  Bookmark,
  Search,
  Sparkles,
  BarChart3,
  Trash2,
  BookOpen,
  Compass,
  CheckCircle2,
  Edit3,
} from "lucide-react";
import { useProfileStore } from "@/hooks/use-profile";
import { useAuthStore } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { t } = useTranslations();
  usePageTitle(t.dashboard.title);
  const profile = useProfileStore();
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const stream = profile.stream || user?.stream || undefined;
  const zscore = profile.zscore ?? user?.zscore ?? undefined;
  const district = profile.district || user?.district || undefined;

  // Profile completion calculation:
  // Required core: stream (35%), zscore (35%), district (30%) = 100%
  let completionPercent = 0;
  if (stream) completionPercent += 35;
  if (zscore !== undefined && zscore !== null) completionPercent += 35;
  if (district) completionPercent += 30;

  const isProfileComplete = completionPercent === 100;

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } =
    useGetDashboardStats();

  const { data: recommendations, isLoading: recsLoading } = useGetRecommendations(
    { stream, zscore, district: district || "Colombo", yearMode: "predicted" },
    {
      query: {
        queryKey: getGetRecommendationsQueryKey({
          stream,
          zscore,
          district: district || "Colombo",
          yearMode: "predicted",
        }),
        enabled: isProfileComplete,
      },
    },
  );

  const { data: savedCourses } = useListSavedCourses();
  const { data: savedUniversities } = useListSavedUniversities();
  const { data: roadmaps } = useListRoadmaps();
  const { data: recentSearches } = useListRecentSearches();

  const [clearingSearches, setClearingSearches] = useState(false);

  const activeRoadmap = roadmaps && roadmaps.length > 0 ? roadmaps[0] : null;

  async function handleClearSearches() {
    try {
      setClearingSearches(true);
      await customFetch("/api/dashboard/recent-searches", { method: "DELETE" });
      queryClient.setQueryData(getListRecentSearchesQueryKey(), []);
      toast({
        title: "Search History Cleared",
        description: "Your recent searches have been removed.",
      });
    } catch {
      toast({
        title: "Failed to clear history",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setClearingSearches(false);
    }
  }

  // Calculate stream max for the bar chart
  const topStreams = stats?.topStreams || [];
  const maxCourseCount = Math.max(...topStreams.map((s) => s.courseCount), 1);

  // Derive first name
  const displayName = user?.name ? user.name.split(" ")[0] : profile.fullName ? profile.fullName.split(" ")[0] : "Student";

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/15 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            <span>Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>👋</span>
            <span>{t.dashboard.welcomeBack ? `${t.dashboard.welcomeBack}, ${displayName}!` : `Welcome back, ${displayName}!`}</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1.5 font-medium">
            Let's take the next step toward your future.
          </p>
        </div>
        <div className="flex items-center self-start sm:self-center">
          <Badge
            variant="outline"
            className="px-3.5 py-1.5 text-xs font-semibold bg-card/80 border-primary/30 text-foreground shadow-xs flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>UGC Handbook {stats?.handbookYear || "2025/2026"}</span>
          </Badge>
        </div>
      </div>

      {statsError && <QueryError onRetry={() => refetchStats()} />}

      {/* 2. Profile Completion / Summary Card */}
      {!isProfileComplete ? (
        <Card className="border-primary/25 bg-gradient-to-br from-primary/5 via-card to-card shadow-xs overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎯</span>
                  <h2 className="text-lg font-bold text-foreground">Complete Your Academic Profile</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  Add your A/L stream, Z-score, and district to unlock personalized university and career recommendations.
                </p>
                <div className="pt-2 max-w-md space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Profile Status</span>
                    <span className="text-primary font-bold">{completionPercent}% Complete</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${Math.max(completionPercent, 8)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                <Button asChild size="default" className="gap-2 shadow-sm font-semibold">
                  <Link href="/settings?tab=profile">
                    Complete Profile
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-emerald-500/25 bg-gradient-to-r from-emerald-500/5 via-card to-card shadow-xs">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-foreground">Your Academic Profile</h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs sm:text-sm text-muted-foreground font-medium">
                    <span className="text-foreground font-semibold">{stream}</span>
                    <span>•</span>
                    <span>Z-Score: <strong className="text-foreground">{zscore?.toFixed(2) ?? zscore}</strong></span>
                    <span>•</span>
                    <span>District: <strong className="text-foreground">{district}</strong></span>
                  </div>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="gap-1.5 self-start sm:self-center shrink-0">
                <Link href="/settings?tab=profile">
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Profile
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Top 4 Personalized Action Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: University Matches */}
        <Card className="flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-md group">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">University Matches</span>
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <GraduationCap className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {recsLoading ? (
                <Skeleton className="h-8 w-16 my-1" />
              ) : (
                <p className="text-3xl font-extrabold tracking-tight text-foreground">
                  {recommendations?.courses?.length ?? (isProfileComplete ? 0 : "—")}
                </p>
              )}
              <p className="text-xs font-medium text-muted-foreground mt-1">
                Matching Degree Programmes
              </p>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                Based on your A/L Profile
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <Button asChild variant="ghost" size="sm" className="w-full justify-between px-2 text-primary font-medium hover:bg-primary/10">
              <Link href="/courses?filter=eligible">
                <span>View Matches</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Career Matches */}
        <Card className="flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-md group">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Career Matches</span>
              <div className="h-8 w-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Briefcase className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {recsLoading ? (
                <Skeleton className="h-8 w-16 my-1" />
              ) : (
                <p className="text-3xl font-extrabold tracking-tight text-foreground">
                  {recommendations?.careers?.length ?? (isProfileComplete ? 0 : "—")}
                </p>
              )}
              <p className="text-xs font-medium text-muted-foreground mt-1">
                Career Paths to Explore
              </p>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                Based on interests & education
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <Button asChild variant="ghost" size="sm" className="w-full justify-between px-2 text-secondary font-medium hover:bg-secondary/10">
              <Link href="/careers">
                <span>Explore Careers</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: Your Roadmap */}
        <Card className="flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-md group">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Your Roadmap</span>
              <div className="h-8 w-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                <MapIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-extrabold tracking-tight text-foreground">
                {activeRoadmap ? "Ready" : "0%"}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-1 line-clamp-1">
                {activeRoadmap ? activeRoadmap.degreeName : "Your Future Roadmap"}
              </p>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                {activeRoadmap ? "Personalized 4-year track" : "Create your personalized path"}
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <Button asChild variant="ghost" size="sm" className="w-full justify-between px-2 text-accent font-medium hover:bg-accent/10">
              <Link href={activeRoadmap ? `/roadmap?courseId=${activeRoadmap.courseId}` : "/roadmap"}>
                <span>{activeRoadmap ? "Continue Roadmap" : "Create Roadmap"}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Card 4: AI Mentor */}
        <Card className="flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-md group">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">AI Mentor</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Bot className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold tracking-tight text-foreground">
                Ask Anything
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                24/7 Guidance Available
              </p>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                Degrees, careers, and skills
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <Button asChild variant="ghost" size="sm" className="w-full justify-between px-2 text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-500/10">
              <Link href="/chat">
                <span>Ask AI Mentor</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 4. Combined Saved Items Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bookmark className="h-5 w-5 text-primary" />
              <span>Your Saved Items</span>
            </CardTitle>
          </div>
          <CardDescription>
            Access and manage your shortlisted courses, universities, and career paths in one place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="courses" className="space-y-4">
            <TabsList className="grid w-full sm:w-80 grid-cols-3">
              <TabsTrigger value="courses">Courses ({savedCourses?.length || 0})</TabsTrigger>
              <TabsTrigger value="universities">Universities ({savedUniversities?.length || 0})</TabsTrigger>
              <TabsTrigger value="careers">Careers</TabsTrigger>
            </TabsList>

            {/* Courses Tab */}
            <TabsContent value="courses" className="space-y-3 pt-2">
              {savedCourses && savedCourses.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {savedCourses.map((c) => (
                    <Link
                      key={c.id}
                      href={`/courses/${c.id}`}
                      className="p-3.5 rounded-xl border border-[hsl(var(--border))] hover:border-primary/50 bg-card hover:bg-muted/30 transition-all flex flex-col justify-between gap-2 shadow-2xs group"
                    >
                      <div>
                        <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2">
                          {c.degreeName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c.universityName}</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-[hsl(var(--border))]/60">
                        <span>{c.stream || "General"}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-[hsl(var(--border))] bg-muted/20">
                  <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium text-sm text-foreground">You haven't saved any courses yet.</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Explore degree programmes across Sri Lankan state universities to build your shortlist.
                  </p>
                  <div className="mt-4">
                    <Button asChild size="sm" variant="default">
                      <Link href="/courses">Explore Courses</Link>
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Universities Tab */}
            <TabsContent value="universities" className="space-y-3 pt-2">
              {savedUniversities && savedUniversities.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {savedUniversities.map((u) => (
                    <Link
                      key={u.id}
                      href={`/universities/${u.id}`}
                      className="p-3.5 rounded-xl border border-[hsl(var(--border))] hover:border-primary/50 bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-2 shadow-2xs group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {u.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{u.location || "Sri Lanka"}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-[hsl(var(--border))] bg-muted/20">
                  <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium text-sm text-foreground">You haven't saved any universities yet.</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Browse UGC state universities to find campus locations, rankings, and details.
                  </p>
                  <div className="mt-4">
                    <Button asChild size="sm" variant="default">
                      <Link href="/universities">Explore Universities</Link>
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Careers Tab */}
            <TabsContent value="careers" className="space-y-3 pt-2">
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-[hsl(var(--border))] bg-muted/20">
                <Briefcase className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium text-sm text-foreground">Explore exciting career opportunities.</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Discover salaries, industry demand, and growth prospects tailored to your field.
                </p>
                <div className="mt-4">
                  <Button asChild size="sm" variant="default">
                    <Link href="/careers">Explore Careers</Link>
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 5. Career Roadmap Spotlight Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapIcon className="h-5 w-5 text-accent" />
              <span>{activeRoadmap ? activeRoadmap.degreeName : "Your Career Roadmap"}</span>
            </CardTitle>
            {activeRoadmap && (
              <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
                Active Path
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {activeRoadmap ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-[hsl(var(--border))] bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Next Milestone / Year 1 Focus
                  </p>
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent shrink-0" />
                    <span>
                      {activeRoadmap.roadmap?.years?.[0]?.milestones?.[0] || "Foundational Coursework & Technical Skills"}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <span>Degree: <strong>{activeRoadmap.degreeName}</strong></span>
                    <span>•</span>
                    <span>Years: <strong>{activeRoadmap.roadmap?.years?.length || 4} Years</strong></span>
                  </div>
                </div>
                <Button asChild className="shrink-0 gap-1.5">
                  <Link href={`/roadmap?courseId=${activeRoadmap.courseId}`}>
                    Continue Roadmap
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-[hsl(var(--border))] bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div className="space-y-1">
                <p className="font-semibold text-foreground">You haven't created a roadmap yet.</p>
                <p className="text-sm text-muted-foreground max-w-lg">
                  Tell us your target degree or career goal and we'll generate a comprehensive year-by-year learning plan.
                </p>
              </div>
              <Button asChild className="shrink-0 gap-1.5">
                <Link href="/roadmap">
                  Create My Roadmap
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6 & 7. Two Column Grid: Explore Programmes (Bar Chart) & Recent Searches */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Explore Sri Lankan Degree Programmes (Bar Chart) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span>Explore Sri Lankan Degree Programmes</span>
            </CardTitle>
            <CardDescription>
              Distribution of degree programmes across UGC A/L study streams.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 pt-2">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : topStreams.length > 0 ? (
              topStreams.map((s) => {
                const percentage = Math.round((s.courseCount / maxCourseCount) * 100);
                return (
                  <div key={s.stream} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-foreground">{s.stream}</span>
                      <span className="text-muted-foreground">{s.courseCount} programmes</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-primary/80 hover:bg-primary h-3 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">Programme statistics will appear here.</p>
            )}
            <div className="pt-2">
              <Button asChild variant="outline" size="sm" className="w-full gap-2 text-xs font-semibold">
                <Link href="/courses">
                  <span>Browse All Degree Programmes</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Searches Card */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Search className="h-4 w-4 text-primary" />
                  <span>Recent Searches</span>
                </CardTitle>
                {recentSearches && recentSearches.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSearches}
                    disabled={clearingSearches}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Clear History</span>
                  </Button>
                )}
              </div>
              <CardDescription>
                Your most recent course and university searches.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentSearches && recentSearches.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {recentSearches.slice(0, 5).map((s) => (
                    <Button
                      key={s.id}
                      variant="outline"
                      size="sm"
                      asChild
                      className="rounded-full text-xs font-medium border-[hsl(var(--border))] hover:border-primary/50 hover:bg-primary/5"
                    >
                      <Link href={`/courses?search=${encodeURIComponent(s.query)}`}>
                        <Search className="h-3 w-3 mr-1 text-muted-foreground" />
                        {s.query}
                      </Link>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 px-3 rounded-lg border border-dashed border-[hsl(var(--border))] bg-muted/10">
                  <Search className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-foreground">No recent searches yet.</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Search for courses like "Medicine", "Computer Science", or "Engineering".
                  </p>
                </div>
              )}
            </CardContent>
          </div>
          <CardContent className="pt-0">
            <div className="p-2.5 rounded-lg bg-muted/40 border border-[hsl(var(--border))]/50 text-[11px] text-muted-foreground flex items-center gap-2">
              <Compass className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Searches are automatically saved when you press Enter on the search bar.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
