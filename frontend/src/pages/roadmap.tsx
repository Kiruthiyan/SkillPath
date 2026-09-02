import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import { Map, Download, Sparkles } from "lucide-react";
import { jsPDF } from "jspdf";

import { useListCourses, useGenerateRoadmap } from "@/api";
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

function downloadRoadmapPdf(roadmap: Roadmap) {
  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(18);
  doc.text(`Career Roadmap: ${roadmap.degreeName}`, 14, y);
  y += 12;
  doc.setFontSize(12);

  for (const year of roadmap.years) {
    doc.text(`Year ${year.year}`, 14, y);
    y += 7;
    for (const milestone of year.milestones) {
      doc.text(`  • ${milestone}`, 18, y);
      y += 6;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    }
    y += 4;
  }

  y += 6;
  doc.text("After Graduation:", 14, y);
  y += 7;
  for (const milestone of roadmap.afterGraduation) {
    doc.text(`  ${milestone.timeframe}: ${milestone.role}`, 18, y);
    y += 6;
  }

  doc.save(`roadmap-${roadmap.courseId}.pdf`);
}

export default function RoadmapPage() {
  const { t, language } = useTranslations();
  usePageTitle(t.roadmap.title);
  const search = useSearch();
  const courseIdParam = getQueryParam(search, "courseId");
  const profile = useProfileStore();
  const { toast } = useToast();

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);

  const { data: courses, isLoading: coursesLoading, isError, refetch } = useListCourses({
    stream: profile.stream || undefined,
  });

  const { mutate: generateRoadmap, isPending } = useGenerateRoadmap({
    mutation: {
      onSuccess: (data) => {
        setRoadmap(data);
        toast({ title: t.roadmap.generatedSuccess });
      },
      onError: () => {
        toast({
          title: "Failed to generate roadmap",
          description: "Please select a course and try again.",
          variant: "destructive",
        });
      },
    },
  });

  useEffect(() => {
    if (courseIdParam) {
      setSelectedCourseId(courseIdParam);
    }
  }, [courseIdParam]);

  useEffect(() => {
    if (selectedCourseId && !roadmap) {
      const langName = language === "si" ? "Sinhala" : language === "ta" ? "Tamil" : "English";
      generateRoadmap({
        data: {
          courseId: parseInt(selectedCourseId),
          stream: profile.stream || undefined,
          targetCareer: undefined,
          additionalContext: `Please generate the roadmap steps and advice in ${langName}.`,
        },
      });
    }
  }, [selectedCourseId]);

  function handleGenerate() {
    if (!selectedCourseId) return;
    const langName = language === "si" ? "Sinhala" : language === "ta" ? "Tamil" : "English";
    generateRoadmap({
      data: {
        courseId: parseInt(selectedCourseId),
        stream: profile.stream || undefined,
        targetCareer: undefined,
        additionalContext: `Please generate the roadmap steps and advice in ${langName}.`,
      },
    });
  }

  return (
    <div className="space-y-8 pb-10 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Map className="h-8 w-8 text-primary" />
          {t.roadmap.title}
        </h1>
        <p className="text-muted-foreground mt-2">{t.roadmap.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.roadmap.selectCourseLabel}</CardTitle>
          <CardDescription>Choose from official degree programmes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isError && <QueryError onRetry={() => refetch()} />}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              value={selectedCourseId}
              onValueChange={setSelectedCourseId}
              disabled={coursesLoading}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={coursesLoading ? "Loading courses..." : t.roadmap.selectCoursePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.degreeName} — {c.universityName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleGenerate}
              disabled={!selectedCourseId || isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isPending ? t.roadmap.generatingBtn : t.roadmap.generateBtn}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isPending && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {roadmap && !isPending && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{roadmap.degreeName}</h2>
              {roadmap.targetCareer && (
                <p className="text-muted-foreground">Target: {roadmap.targetCareer}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadRoadmapPdf(roadmap)}>
              <Download className="h-4 w-4 mr-2" /> {t.roadmap.downloadPdfBtn}
            </Button>
          </div>

          <div className="space-y-4">
            {roadmap.years.map((yr) => (
              <Card key={yr.year}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant="outline">{t.roadmap.year} {yr.year}</Badge>
                    {t.roadmap.milestones}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {yr.milestones.map((m, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}

            {roadmap.afterGraduation && roadmap.afterGraduation.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t.roadmap.afterGraduation}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {roadmap.afterGraduation.map((ag, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-[hsl(var(--border))]">
                        <p className="text-xs text-muted-foreground font-medium">{ag.timeframe}</p>
                        <p className="font-semibold mt-1">{ag.role}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
