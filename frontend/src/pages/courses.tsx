import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Search, GraduationCap, Target, Building2, Info } from "lucide-react";

import {
  useListCourses,
  useListUniversities,
  useRecordSearch,
} from "@/api";
import { useProfileStore } from "@/hooks/use-profile";
import { useAuthStore } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function getQueryParam(search: string, key: string): string | null {
  return new URLSearchParams(search).get(key);
}

const ELIGIBILITY_STYLES: Record<string, string> = {
  likely: "bg-green-500/15 text-green-700 border-green-500/30",
  borderline: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  reach: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  unlikely: "bg-red-500/15 text-red-700 border-red-500/30",
};

function displayMedium(medium: string | string[] | null | undefined): string | null {
  if (Array.isArray(medium)) return medium.join(" / ");
  return medium ?? null;
}

export default function Courses() {
  usePageTitle("Courses");
  const urlSearch = useSearch();
  const [search, setSearch] = useState("");
  const [universityFilter, setUniversityFilter] = useState<string>(
    () => getQueryParam(urlSearch, "universityId") ?? "all",
  );

  const profile = useProfileStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const params = useMemo(
    () => ({
      stream: profile.stream || undefined,
      zscore: profile.zscore ?? undefined,
      district: profile.district || "Colombo",
      yearMode: "predicted" as const,
      universityId: universityFilter !== "all" ? Number(universityFilter) : undefined,
    }),
    [profile.stream, profile.zscore, profile.district, universityFilter],
  );

  const { data: courses, isLoading, isError, refetch } = useListCourses(params);
  const { data: universities } = useListUniversities();

  const { mutate: recordSearch } = useRecordSearch();

  const filtered = useMemo(() => {
    if (!courses) return [];
    if (!search.trim()) return courses;
    const q = search.toLowerCase();
    return courses.filter(
      (c) =>
        c.degreeName.toLowerCase().includes(q) ||
        c.universityName.toLowerCase().includes(q) ||
        (c.faculty ?? "").toLowerCase().includes(q) ||
        (c.uniCode ?? "").toLowerCase().includes(q),
    );
  }, [courses, search]);

  function handleSearch(value: string) {
    setSearch(value);
    if (value.trim() && isAuthenticated) {
      recordSearch({ data: { query: value, filters: params } });
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
        <p className="text-muted-foreground mt-2">
          Government university programmes from official handbook-derived local data.
        </p>
      </div>

      <Card className="border-secondary/40 bg-secondary/5">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <Info className="h-5 w-5 shrink-0 text-secondary" />
          <p>
            Missing handbook fields are shown as unavailable. Cutoffs are shown only where an exact
            official district mapping exists for {profile.district || "selected"} quota.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            className="pl-10"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Select value={universityFilter} onValueChange={setUniversityFilter}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="University" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Universities</SelectItem>
            {universities?.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>{u.shortName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError && <QueryError onRetry={() => refetch()} />}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid sm:grid-cols-2 gap-6"
        >
          {filtered.map((course) => (
            <Card key={course.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <GraduationCap className="h-6 w-6 text-primary shrink-0" />
                  <div className="flex flex-wrap gap-1 justify-end">
                    {course.eligibility && (
                      <Badge
                        variant="outline"
                        className={ELIGIBILITY_STYLES[course.eligibility] ?? ""}
                      >
                        {course.eligibility}
                      </Badge>
                    )}
                    {course.matchScore && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Target className="h-3 w-3" /> {course.matchScore}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-lg">{course.degreeName}</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {course.universityName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{course.uniCode}</Badge>
                  {course.eligibleStreams?.map((stream) => (
                    <Badge key={stream} variant="outline">{stream}</Badge>
                  ))}
                  {course.faculty && <Badge variant="outline">{course.faculty}</Badge>}
                  {course.duration && <Badge variant="outline">{course.duration}</Badge>}
                  {displayMedium(course.medium) && (
                    <Badge variant="outline">{displayMedium(course.medium)}</Badge>
                  )}
                  {course.intake != null && <Badge variant="outline">Intake: {course.intake}</Badge>}
                  <Badge variant="outline">
                    {course.minimumZScore != null
                      ? `Cutoff: ${course.minimumZScore}${course.officialAcademicYear ? ` (${course.officialAcademicYear})` : ""}`
                      : "Cutoff not mapped"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" asChild>
                    <Link href={`/courses/${course.id}`}>View Details</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No courses match your filters. Import handbook data with{" "}
          <code className="text-xs">pnpm handbook:import</code> if the list is empty.
        </p>
      )}
    </div>
  );
}
