import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import {
  Map,
  Download,
  Sparkles,
  Loader2,
  Briefcase,
  GraduationCap,
  TrendingUp,
  CheckCircle2,
  Building2,
  Search,
} from "lucide-react";
import { jsPDF } from "jspdf";

import { useListCourses, useGenerateRoadmap, ApiError } from "@/api";
import type { Roadmap } from "@/api";
import { useProfileStore } from "@/hooks/use-profile";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
import { QueryError } from "@/components/query-error";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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

function downloadRoadmapPdf(roadmap: Roadmap, universityName?: string) {
  const doc = new jsPDF();
  let y = 20;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(24, 76, 120);
  doc.text("SkillPath AI — Career Roadmap", 14, y);
  y += 10;

  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text(`Degree: ${roadmap.degreeName}`, 14, y);
  y += 7;

  if (universityName) {
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text(`Institution: ${universityName}`, 14, y);
    y += 8;
  } else {
    y += 3;
  }

  doc.setDrawColor(210, 220, 230);
  doc.line(14, y, 196, y);
  y += 10;

  // Academic progression
  doc.setFontSize(14);
  doc.setTextColor(24, 76, 120);
  doc.text("Undergraduate Academic & Skill Progression", 14, y);
  y += 8;

  for (const year of roadmap.years) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(`Year ${year.year}`, 14, y);
    y += 6;

    for (const milestone of year.milestones) {
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(`• ${milestone}`, 175);
      for (const line of lines) {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 18, y);
        y += 5.5;
      }
    }
    y += 4;
  }

  // Career trajectory
  if (roadmap.afterGraduation && roadmap.afterGraduation.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    y += 4;
    doc.setFontSize(14);
    doc.setTextColor(24, 76, 120);
    doc.text("Career Trajectory & Postgraduate Pathways", 14, y);
    y += 8;

    for (const milestone of roadmap.afterGraduation) {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text(`[${milestone.timeframe}]`, 14, y);
      y += 5.5;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(milestone.role, 175);
      for (const line of lines) {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 18, y);
        y += 5.5;
      }
      y += 3;
    }
  }

  doc.save(`roadmap-${roadmap.courseId}.pdf`);
}

export default function RoadmapPage() {
  const { t } = useTranslations();
  usePageTitle(t.roadmap.title);
  const search = useSearch();
  const courseIdParam = getQueryParam(search, "courseId");
  const profile = useProfileStore();
  const { toast } = useToast();

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courseSearch, setCourseSearch] = useState<string>("");
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);

  // Load all available courses without filtering by profile stream so no course is missed
  const { data: rawCourses, isLoading: coursesLoading, isError, refetch } = useListCourses();

  const courses = useMemo(() => {
    if (!rawCourses) return [];
    return [...rawCourses].sort((a, b) => {
      const comp = a.degreeName.localeCompare(b.degreeName);
      if (comp !== 0) return comp;
      return a.universityName.localeCompare(b.universityName);
    });
  }, [rawCourses]);

  const filteredCourses = useMemo(() => {
    if (!courseSearch.trim()) return courses;
    const q = courseSearch.toLowerCase();
    return courses.filter(
      (c) =>
        c.degreeName.toLowerCase().includes(q) ||
        c.universityName.toLowerCase().includes(q) ||
        (c.faculty ?? "").toLowerCase().includes(q) ||
        (c.stream ?? "").toLowerCase().includes(q),
    );
  }, [courses, courseSearch]);

  const selectedCourse = useMemo(() => {
    return courses?.find((c) => String(c.id) === selectedCourseId);
  }, [courses, selectedCourseId]);

  const { mutate: generateRoadmap, isPending } = useGenerateRoadmap({
    mutation: {
      onSuccess: (data) => {
        setRoadmap(data);
        toast({ title: t.roadmap.generatedSuccess });
      },
      onError: (error) => {
        const description =
          error instanceof ApiError && error.status === 404
            ? "This course could not be found. Please pick a different course."
            : error instanceof ApiError && error.status === 429
              ? "Too many requests. Please wait a moment and try again."
              : "Something went wrong while generating the roadmap. Please try again.";
        toast({
          title: "Failed to generate roadmap",
          description,
          variant: "destructive",
        });
      },
    },
  });

  // Auto-generate ONLY when arriving with a specific courseId in the URL
  useEffect(() => {
    if (courseIdParam) {
      setSelectedCourseId(courseIdParam);
      generateRoadmap({
        data: {
          courseId: parseInt(courseIdParam),
          stream: profile.stream || undefined,
          zscore: profile.zscore ?? undefined,
        },
      });
    }
  }, [courseIdParam]);

  function handleGenerate() {
    if (!selectedCourseId || isPending) return;
    generateRoadmap({
      data: {
        courseId: parseInt(selectedCourseId),
        stream: profile.stream || undefined,
        zscore: profile.zscore ?? undefined,
      },
    });
  }

  return (
    <div className="space-y-8 pb-12 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Map className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              {t.roadmap.title}
              <Badge variant="secondary" className="gap-1 font-normal text-xs">
                <Sparkles className="h-3 w-3 text-primary" /> Powered by Gemini
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">{t.roadmap.subtitle}</p>
          </div>
        </div>
      </div>

      <Card className="shadow-xs border-[hsl(var(--border))]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{t.roadmap.selectCourseLabel}</CardTitle>
          <CardDescription>
            Choose from official degree programmes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError && <QueryError onRetry={() => refetch()} />}

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={selectedCourseId}
                onValueChange={(val) => {
                  setSelectedCourseId(val);
                  setRoadmap(null);
                }}
                disabled={coursesLoading || isPending}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue
                    placeholder={
                      coursesLoading ? "Loading courses..." : t.roadmap.selectCoursePlaceholder
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <div
                    className="p-2 border-b border-[hsl(var(--border))] sticky top-0 bg-popover z-10"
                    onKeyDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        value={courseSearch}
                        onChange={(e) => setCourseSearch(e.target.value)}
                        placeholder="Search courses or universities..."
                        className="h-8 pl-8 pr-7 text-xs bg-muted/50 border-input"
                        autoFocus
                      />
                      {courseSearch && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseSearch("");
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  {filteredCourses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.degreeName} — {c.universityName}
                    </SelectItem>
                  ))}
                  {filteredCourses.length === 0 && !coursesLoading && (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      No matching courses found
                    </div>
                  )}
                </SelectContent>
              </Select>

              <Button
                onClick={handleGenerate}
                disabled={!selectedCourseId || isPending}
                className="w-full sm:w-auto px-6 font-medium shadow-xs"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t.roadmap.generatingBtn}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t.roadmap.generateBtn}
                  </>
                )}
              </Button>
            </div>

            {selectedCourse && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  {selectedCourse.universityName}
                </span>
                {selectedCourse.faculty && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5" />
                      {selectedCourse.faculty}
                    </span>
                  </>
                )}
                {selectedCourse.duration && (
                  <>
                    <span>•</span>
                    <span>{selectedCourse.duration}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isPending && (
        <Card className="p-8 border-dashed">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="p-4 rounded-full bg-primary/10 text-primary animate-pulse">
              <Sparkles className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Generating Your Personalized AI Roadmap...</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-1">
                Gemini is analysing university curriculum requirements, Sri Lankan industry demand, internship targets, and postgraduate scholarship opportunities.
              </p>
            </div>
            <div className="w-full max-w-md space-y-2 pt-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5 mx-auto" />
            </div>
          </div>
        </Card>
      )}

      {roadmap && !isPending && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border bg-card/60 backdrop-blur-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                  Tailored Execution Plan
                </Badge>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{roadmap.degreeName}</h2>
              {selectedCourse?.universityName && (
                <p className="text-sm text-muted-foreground mt-0.5">{selectedCourse.universityName}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadRoadmapPdf(roadmap, selectedCourse?.universityName)}
              className="self-start sm:self-center gap-2 shadow-2xs hover:bg-secondary/50"
            >
              <Download className="h-4 w-4" /> {t.roadmap.downloadPdfBtn}
            </Button>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                <GraduationCap className="h-5 w-5 text-primary" />
                Undergraduate Academic & Skill Milestones
              </h3>

              <div className="space-y-4">
                {roadmap.years.map((yr, yIdx) => (
                  <Card key={yr.year} className="relative overflow-hidden border-l-4 border-l-primary shadow-2xs">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2 font-semibold">
                          <Badge variant="secondary" className="font-semibold">
                            {t.roadmap.year} {yr.year}
                          </Badge>
                          <span>Academic Execution & Competencies</span>
                        </CardTitle>
                        <span className="text-xs text-muted-foreground font-mono">
                          Step {yIdx + 1} of {roadmap.years.length}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2.5">
                        {yr.milestones.map((m, idx) => (
                          <li key={idx} className="flex items-start gap-3 text-sm leading-relaxed">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span className="text-foreground/90">{m}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {roadmap.afterGraduation && roadmap.afterGraduation.length > 0 && (
              <div className="pt-3">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
                  <Briefcase className="h-5 w-5 text-primary" />
                  {t.roadmap.afterGraduation}
                </h3>

                <div className="grid sm:grid-cols-2 gap-3.5">
                  {roadmap.afterGraduation.map((ag, idx) => (
                    <Card key={idx} className="relative border shadow-2xs hover:border-primary/40 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider bg-secondary/30">
                            {ag.timeframe}
                          </Badge>
                          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed text-foreground font-normal">{ag.role}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
