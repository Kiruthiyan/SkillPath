import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import {
  useListSavedCourses,
  useSaveCourse,
  useUnsaveCourse,
  getListSavedCoursesQueryKey,
} from "@/api";
import { useAuthStore } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface BookmarkCourseButtonProps {
  courseId: number;
  size?: "sm" | "default";
  className?: string;
}

export function BookmarkCourseButton({ courseId, size = "sm", className }: BookmarkCourseButtonProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const { data: savedCourses } = useListSavedCourses({
    query: {
      queryKey: getListSavedCoursesQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const isSaved = useMemo(
    () => savedCourses?.some((c) => c.id === courseId) ?? false,
    [savedCourses, courseId],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListSavedCoursesQueryKey() });
  };

  const { mutate: saveCourse, isPending: isSaving } = useSaveCourse({
    mutation: {
      onSuccess: () => {
        toast({ title: "Course saved" });
        invalidate();
      },
      onError: () => toast({ title: "Sign in to save courses", variant: "destructive" }),
    },
  });

  const { mutate: unsaveCourse, isPending: isUnsaving } = useUnsaveCourse({
    mutation: {
      onSuccess: () => {
        toast({ title: "Course removed from saved" });
        invalidate();
      },
      onError: () => toast({ title: "Failed to remove course", variant: "destructive" }),
    },
  });

  if (!isAuthenticated) return null;

  const pending = isSaving || isUnsaving;

  return (
    <Button
      size={size}
      variant={isSaved ? "secondary" : "outline"}
      className={className}
      disabled={pending}
      onClick={() =>
        isSaved ? unsaveCourse({ courseId }) : saveCourse({ data: { courseId } })
      }
      aria-label={isSaved ? "Remove saved course" : "Save course"}
    >
      {isSaved ? (
        <BookmarkCheck className="h-3 w-3 mr-1" />
      ) : (
        <Bookmark className="h-3 w-3 mr-1" />
      )}
      {isSaved ? "Saved" : "Save"}
    </Button>
  );
}
