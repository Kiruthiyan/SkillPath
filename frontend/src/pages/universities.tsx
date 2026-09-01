import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Building2, MapPin, Calendar, ArrowLeft } from "lucide-react";

import {
  useListUniversities,
  useGetUniversity,
  getGetUniversityQueryKey,
} from "@/api";
import { usePageTitle } from "@/hooks/use-page-title";
import { QueryError } from "@/components/query-error";
import { BookmarkUniversityButton } from "@/components/bookmark-university-button";
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
            <Badge variant="secondary" className="w-fit">Rank #{university.ranking}</Badge>
            <CardTitle className="text-3xl">{university.name}</CardTitle>
            <CardDescription className="flex items-center gap-4 text-base">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {university.location}</span>
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Est. {university.foundedYear}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">{university.description}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild><Link href={`/courses?universityId=${university.id}`}>View Courses</Link></Button>
              <BookmarkUniversityButton universityId={university.id} />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Universities</h1>
        <p className="text-muted-foreground mt-2">Explore Sri Lankan state universities and their programs.</p>
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
          {universities?.map((univ) => (
            <Card key={univ.id} className="hover:border-primary/50 transition-colors overflow-hidden">
              <div className="h-2" style={{ backgroundColor: univ.logoColor }} />
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Building2 className="h-8 w-8 text-primary" />
                  <Badge variant="outline">#{univ.ranking}</Badge>
                </div>
                <CardTitle className="text-lg">{univ.name}</CardTitle>
                <CardDescription>{univ.shortName} · {univ.location}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{univ.description}</p>
                <Button size="sm" asChild>
                  <Link href={`/universities/${univ.id}`}>View Details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  );
}
