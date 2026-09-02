import { useMemo } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import { Star, BadgeCheck } from "lucide-react";

import { useListReviews, useGetCourse, getGetCourseQueryKey } from "@/api";
import { useProfileStore } from "@/hooks/use-profile";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function getQueryParam(search: string, key: string): string | null {
  return new URLSearchParams(search).get(key);
}

export default function Reviews() {
  const { t } = useTranslations();
  usePageTitle(t.reviews.title);
  const search = useSearch();
  const courseIdParam = getQueryParam(search, "courseId");
  const courseId = courseIdParam ? parseInt(courseIdParam) : undefined;
  const profile = useProfileStore();
  const district = profile.district || "Colombo";

  const { data: course } = useGetCourse(
    courseId ?? 0,
    { district, yearMode: "predicted" },
    {
      query: {
        queryKey: getGetCourseQueryKey(courseId ?? 0),
        enabled: !!courseId,
      },
    },
  );

  const { data: reviews, isLoading, isError, refetch } = useListReviews(
    courseId ? { courseId } : undefined,
  );

  const avgRating = useMemo(() => {
    if (!reviews?.length) return 0;
    const rated = reviews.filter((r) => r.rating);
    if (!rated.length) return 0;
    return rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length;
  }, [reviews]);

  const subtitle = courseId
    ? course?.degreeName
      ? `${t.reviews.reviewsFor} ${course.degreeName}`
      : "Loading course..."
    : t.reviews.subtitle;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.reviews.title}</h1>
        <p className="text-muted-foreground mt-2">{subtitle}</p>
        {avgRating > 0 && (
          <div className="flex items-center gap-1 mt-2 text-sm">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{avgRating.toFixed(1)}</span>
            <span className="text-muted-foreground">({reviews?.length} {t.reviews.courseReviews})</span>
          </div>
        )}
      </div>

      {isError && <QueryError onRetry={() => refetch()} />}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid sm:grid-cols-2 gap-6"
        >
          {reviews?.map((review) => (
            <Card key={review.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <CardTitle className="text-base">{review.authorName}</CardTitle>
                      {review.isVerified && (
                        <BadgeCheck className="h-4 w-4 text-primary" title={t.reviews.verifiedAlumni} />
                      )}
                    </div>
                    <CardDescription>
                      {review.graduationYear ? `Class of ${review.graduationYear}` : t.reviews.verifiedAlumni}
                    </CardDescription>
                  </div>
                  {review.rating && (
                    <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded text-xs font-semibold">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {review.rating}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{review.reviewText}</p>
                {review.pros && (
                  <p className="text-xs text-green-600">
                    <span className="font-medium">+ </span>{review.pros}
                  </p>
                )}
                {review.cons && (
                  <p className="text-xs text-red-500">
                    <span className="font-medium">- </span>{review.cons}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {!isLoading && !reviews?.length && (
        <p className="text-center text-muted-foreground py-12">{t.reviews.noReviews}</p>
      )}
    </div>
  );
}
