import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Building2, ArrowLeft } from "lucide-react";

import {
  useListUniversities,
  useGetUniversity,
  getGetUniversityQueryKey,
} from "@/api";
import { usePageTitle } from "@/hooks/use-page-title";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Universities() {
  const params = useParams();
  const universityId = params.id ? parseInt(params.id) : null;

  const { data: universities, isLoading, isError, refetch } = useListUniversities();
  const { data: university, isLoading: isLoadingDetail, isError: isDetailError, refetch: refetchDetail } =
    useGetUniversity(universityId ?? 0, {
      query: {
        queryKey: getGetUniversityQueryKey(universityId ?? 0),
        enabled: !!universityId,
      },
    });

  usePageTitle(university?.name ?? (universityId ? "University Details" : "Universities"));

  if (universityId) {
    if (isLoadingDetail) {
      return <Skeleton className="h-64 w-full" />;
    }
    if (isDetailError) {
      return <QueryError onRetry={() => refetchDetail()} />;
    }
    if (!university) {
      return (
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-4">University not found</h2>
          <Button asChild><Link href="/universities">Back to Universities</Link></Button>
        </div>
      );
    }

    return (
      <div className="space-y-8 pb-10">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/universities"><ArrowLeft className="h-4 w-4 mr-2" /> All Universities</Link>
        </Button>
        <Card className="overflow-hidden">
          <div className="h-3" style={{ backgroundColor: university.logoColor }} />
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              {university.courseCount ?? 0} official courses
            </Badge>
            <CardTitle className="text-3xl">{university.name}</CardTitle>
            <CardDescription className="text-base">
              Official handbook-derived 2025/2026 course provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link href={`/courses?universityId=${university.id}`}>View Courses</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Universities</h1>
        <p className="text-muted-foreground mt-2">
          Explore providers exactly as they appear in the official handbook-derived course data.
        </p>
      </div>

      {isError && <QueryError onRetry={() => refetch()} />}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {universities?.map((universityRow) => (
            <Card key={universityRow.id} className="hover:border-primary/50 transition-colors overflow-hidden">
              <div className="h-2" style={{ backgroundColor: universityRow.logoColor }} />
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <Building2 className="h-8 w-8 text-primary shrink-0" />
                  <Badge variant="outline">{universityRow.courseCount ?? 0} courses</Badge>
                </div>
                <CardTitle className="text-lg">{universityRow.name}</CardTitle>
                <CardDescription>Official handbook-derived provider</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" asChild>
                  <Link href={`/universities/${universityRow.id}`}>View Details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  );
}
