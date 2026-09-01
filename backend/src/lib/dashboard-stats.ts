export function buildDashboardStatsResponse(
  counts: {
    universities: number;
    courses: number;
    reviews: number;
    stories: number;
  },
  streamStats: Array<{ stream: string; count: number }>,
  handbookYear: string | null,
) {
  return {
    totalUniversities: counts.universities,
    totalCourses: counts.courses,
    totalReviews: counts.reviews,
    totalSuccessStories: counts.stories,
    topStreams: streamStats.map((s) => ({
      stream: s.stream,
      courseCount: s.count,
    })),
    handbookYear,
  };
}
