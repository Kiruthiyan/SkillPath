import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import { Map, Download, Sparkles } from "lucide-react";
import { jsPDF } from "jspdf";

import { useListCourses, useGenerateRoadmap } from "@/api";
import type { Roadmap } from "@/api";
import { useProfileStore } from "@/hooks/use-profile";
import { usePageTitle } from "@/hooks/use-page-title";
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
  usePageTitle("Career Roadmap");
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
        toast({ title: "Roadmap generated!" });
      },
      onError: () => {
        toast({ title: "Failed to generate roadmap", variant: "destructive" });
      },
    },
  });

  useEffect(() => {
    if (courseIdParam) {
      setSelectedCourseId(courseIdParam);
    }
  }, [courseIdParam]);

  function handleGenerate() {
    const courseId = parseInt(selectedCourseId);
    if (!courseId) {
      toast({ title: "Select a course first", variant: "destructive" });
      return;
    }
    generateRoadmap({
      data: {
        courseId,
        stream: profile.stream || undefined,
        zscore: profile.zscore ?? undefined,
      },
    });
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Map className="h-8 w-8 text-primary" />
          AI Career Roadmap
        </h1>
        <p className="text-muted-foreground mt-2">
          Generate a personalized year-by-year plan for your chosen degree.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select a Course</CardTitle>
          <CardDescription>Choose a degree program to generate your roadmap</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          {isError && <QueryError onRetry={() => refetch()} />}
          {coursesLoading ? (
            <Skeleton className="h-10 flex-1" />
          ) : (
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Choose a course..." />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.degreeName} — {c.universityShortName ?? c.universityName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleGenerate} disabled={isPending || !selectedCourseId}>
            <Sparkles className="h-4 w-4 mr-2" />
            {isPending ? "Generating..." : "Generate Roadmap"}
          </Button>
        </CardContent>
      </Card>

      {roadmap && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{roadmap.degreeName}</h2>
            <Button variant="outline" onClick={() => downloadRoadmapPdf(roadmap)}>
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roadmap.years.map((year) => (
              <Card key={year.year}>
                <CardHeader>
                  <Badge>Year {year.year}</Badge>
                  <CardTitle className="text-lg">Milestones</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {year.milestones.map((m, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-primary">•</span> {m}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>After Graduation</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              {roadmap.afterGraduation.map((m, i) => (
                <div key={i} className="p-4 rounded-lg border border-[hsl(var(--border))]">
                  <p className="text-sm text-muted-foreground">{m.timeframe}</p>
                  <p className="font-medium">{m.role}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
