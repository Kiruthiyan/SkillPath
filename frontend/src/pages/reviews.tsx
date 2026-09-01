import { useMemo } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import { Star, BadgeCheck } from "lucide-react";

import { useListReviews, useGetCourse, getGetCourseQueryKey } from "@/api";
import { useProfileStore } from "@/hooks/use-profile";
import { usePageTitle } from "@/hooks/use-page-title";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function getQueryParam(search: string, key: string): string | null {
  return new URLSearchParams(search).get(key);
}

export default function Reviews() {
  usePageTitle("Alumni Reviews");
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
      ? `Reviews for ${course.degreeName}`
      : "Loading course..."
    : "Real experiences from university graduates.";

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alumni Reviews</h1>
        <p className="text-muted-foreground mt-2">{subtitle}</p>
        {avgRating > 0 && (
          <div className="flex items-center gap-1 mt-2 text-sm">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            {avgRating.toFixed(1)} average rating
          </div>
        )}
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
          {reviews?.map((review) => (
            <Card key={review.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: review.avatarColor ?? "#1e3a5f" }}
                  >
                    {review.reviewerName.charAt(0)}
                  </div>
                  {review.isVerified && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3" /> Verified
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{review.reviewerName}</CardTitle>
                <CardDescription>
                  {review.degreeName} · {review.universityName} · {review.graduationYear}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {review.currentPosition} at {review.company}
                </p>
                {review.rating && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < review.rating! ? "fill-yellow-400 text-yellow-400" : "text-muted"}`}
                      />
                    ))}
                  </div>
                )}
                <p className="text-sm leading-relaxed">{review.reviewText}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {!isLoading && !reviews?.length && (
        <p className="text-center text-muted-foreground py-12">No reviews found.</p>
      )}
    </div>
  );
}
