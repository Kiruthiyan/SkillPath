import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Search, GraduationCap, Building2, Clock, Target } from "lucide-react";

import {
  useListCourses,
  useListUniversities,
  useListCheckerAcademicYears,
  useRecordSearch,
} from "@/api";
import { useProfileStore } from "@/hooks/use-profile";
import { useAuthStore } from "@/hooks/use-auth";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
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
  const { t } = useTranslations();
  usePageTitle(t.courses.title);
  const urlSearch = useSearch();
  const STREAMS = ["Physical Science", "Biological Science", "Commerce", "Arts", "Technology"];
  const FACULTIES = [
    "Aesthetic Studies",
    "Arts",
    "Computing",
    "Dental Sciences",
    "Engineering",
    "Health-Care Sciences",
    "Indigenous Medicine",
    "Medical Sciences",
    "Medicine",
    "Medicine & Allied Sciences",
    "Veterinary Medicine and Animal Science",
    "Visual & Performing Arts",
  ];
  const MEDIUMS = ["Sinhala", "Tamil", "English"];

  const profile = useProfileStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const [search, setSearch] = useState("");

  const [streamFilter, setStreamFilter] = useState<string>(
    () => getQueryParam(urlSearch, "stream") ?? "all",
  );
  const [universityFilter, setUniversityFilter] = useState<string>(
    () => getQueryParam(urlSearch, "universityId") ?? "all",
  );
  const [facultyFilter, setFacultyFilter] = useState<string>(
    () => getQueryParam(urlSearch, "faculty") ?? "all",
  );
  const [mediumFilter, setMediumFilter] = useState<string>(
    () => getQueryParam(urlSearch, "medium") ?? "all",
  );
  const [academicYearFilter, setAcademicYearFilter] = useState<string>(
    () => getQueryParam(urlSearch, "academicYear") ?? "all",
  );

  const params = useMemo(
    () => ({
      stream: streamFilter !== "all" ? streamFilter : undefined,
      zscore: profile.zscore ?? undefined,
      district: profile.district || "Colombo",
      yearMode: "predicted" as const,
      universityId: universityFilter !== "all" ? Number(universityFilter) : undefined,
      faculty: facultyFilter !== "all" ? facultyFilter : undefined,
      medium: mediumFilter !== "all" ? mediumFilter : undefined,
      academicYear: academicYearFilter !== "all" ? academicYearFilter : undefined,
    }),
    [
      streamFilter,
      profile.zscore,
      profile.district,
      universityFilter,
      facultyFilter,
      mediumFilter,
      academicYearFilter,
    ],
  );

  const { data: courses, isLoading, isError, refetch } = useListCourses(params);
  const { data: universities } = useListUniversities();
  const { data: academicYears } = useListCheckerAcademicYears();

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

  function getEligibilityLabel(eligibility: string | undefined) {
    if (!eligibility) return null;
    switch (eligibility.toLowerCase()) {
      case "likely":
        return t.courses.eligibilityLikely;
      case "borderline":
        return t.courses.eligibilityBorderline;
      case "reach":
        return t.courses.eligibilityReach;
      default:
        return t.courses.eligibilityUnlikely;
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.courses.title}</h1>
        <p className="text-muted-foreground mt-2">{t.courses.subtitle}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.courses.searchPlaceholder}
            className="pl-10"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Select value={streamFilter} onValueChange={setStreamFilter}>
          <SelectTrigger className="w-full md:w-52">
            <SelectValue placeholder="All Streams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Streams</SelectItem>
            {STREAMS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={universityFilter} onValueChange={setUniversityFilter}>
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder={t.courses.filterByUni} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.courses.allUniversities}</SelectItem>
            {universities?.map((u) => (
              <SelectItem key={u.id} value={String(u.id)}>{u.shortName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={facultyFilter} onValueChange={setFacultyFilter}>
          <SelectTrigger className="w-full md:w-52">
            <SelectValue placeholder="All Faculties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Faculties</SelectItem>
            {FACULTIES.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mediumFilter} onValueChange={setMediumFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="All Mediums" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Mediums</SelectItem>
            {MEDIUMS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={academicYearFilter} onValueChange={setAcademicYearFilter}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="All Academic Years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Academic Years</SelectItem>
            {academicYears?.map((y) => (
              <SelectItem key={y.academicYear} value={y.academicYear}>{y.academicYear}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError && <QueryError onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} course{filtered.length === 1 ? "" : "s"}
        </p>
      )}

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
            <Card key={course.id} className="hover:border-primary/50 transition-colors flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <GraduationCap className="h-6 w-6 text-primary shrink-0" />
                  <div className="flex flex-wrap gap-1 justify-end">
                    {course.eligibility && (
                      <Badge
                        variant="outline"
                        className={ELIGIBILITY_STYLES[course.eligibility] ?? ""}
                      >
                        {getEligibilityLabel(course.eligibility)}
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
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                  {course.faculty && (
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 shrink-0" /> {course.faculty}
                    </div>
                  )}
                  {course.duration && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" /> {course.duration}
                    </div>
                  )}
                  {displayMedium(course.medium) && (
                    <div className="flex items-center gap-1.5 col-span-2">
                      {displayMedium(course.medium)}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Target className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {course.minimumZScore != null
                    ? `Cutoff: ${course.minimumZScore}${course.officialAcademicYear ? ` (${course.officialAcademicYear})` : ""}`
                    : "Cutoff not mapped"}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" asChild>
                    <Link href={`/courses/${course.id}`}>{t.courses.viewCourse}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          {t.courses.noCoursesFound}
        </p>
      )}
    </div>
  );
}
