import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { Building2, ArrowLeft } from "lucide-react";

import {
  useListUniversities,
  useGetUniversity,
  getGetUniversityQueryKey,
} from "@/api";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Universities() {
  const { t } = useTranslations();
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

  usePageTitle(university?.name ?? (universityId ? "University Details" : t.universities.title));

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
          <h2 className="text-2xl font-bold mb-4">{t.universities.notFound}</h2>
          <Button asChild><Link href="/universities">{t.universities.backToUniversities}</Link></Button>
        </div>
      );
    }

    return (
      <div className="space-y-8 pb-10">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/universities"><ArrowLeft className="h-4 w-4 mr-2" /> {t.universities.allUniversities}</Link>
        </Button>
        <Card className="overflow-hidden">
          <div className="h-3" style={{ backgroundColor: university.logoColor ?? "#1e3a5f" }} />
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              {university.courseCount ?? 0} {t.universities.officialCourses}
            </Badge>
            <CardTitle className="text-3xl">{university.name}</CardTitle>
            <CardDescription className="text-base">
              {t.universities.providerDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link href={`/courses?universityId=${university.id}`}>{t.universities.viewCourses}</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.universities.title}</h1>
        <p className="text-muted-foreground mt-2">{t.universities.subtitle}</p>
      </div>

      {isError && <QueryError onRetry={() => refetch()} />}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {universities?.map((u) => (
            <Card key={u.id} className="overflow-hidden hover:border-primary/50 transition-colors flex flex-col justify-between">
              <div>
                <div className="h-2" style={{ backgroundColor: u.logoColor ?? "#1e3a5f" }} />
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
                      style={{ backgroundColor: u.logoColor ?? "#1e3a5f" }}
                    >
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base leading-snug">{u.name}</CardTitle>
                      {u.location && <p className="text-xs text-muted-foreground">{u.location}</p>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Badge variant="secondary">
                    {u.courseCount ?? 0} {t.universities.officialCourses}
                  </Badge>
                </CardContent>
              </div>
              <div className="p-6 pt-0">
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/courses?universityId=${u.id}`}>{t.universities.viewCourses}</Link>
                </Button>
              </div>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  );
}
