import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import {
  useListSavedUniversities,
  useSaveUniversity,
  useUnsaveUniversity,
  getListSavedUniversitiesQueryKey,
} from "@/api";
import { useAuthStore } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface BookmarkUniversityButtonProps {
  universityId: number;
  size?: "sm" | "default";
  className?: string;
}

export function BookmarkUniversityButton({
  universityId,
  size = "default",
  className,
}: BookmarkUniversityButtonProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const { data: savedUniversities } = useListSavedUniversities({
    query: {
      queryKey: getListSavedUniversitiesQueryKey(),
      enabled: isAuthenticated,
    },
  });

  const isSaved = useMemo(
    () => savedUniversities?.some((u) => u.id === universityId) ?? false,
    [savedUniversities, universityId],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListSavedUniversitiesQueryKey() });
  };

  const { mutate: saveUniversity, isPending: isSaving } = useSaveUniversity({
    mutation: {
      onSuccess: () => {
        toast({ title: "University saved" });
        invalidate();
      },
      onError: () => toast({ title: "Sign in to save universities", variant: "destructive" }),
    },
  });

  const { mutate: unsaveUniversity, isPending: isUnsaving } = useUnsaveUniversity({
    mutation: {
      onSuccess: () => {
        toast({ title: "University removed from saved" });
        invalidate();
      },
      onError: () => toast({ title: "Failed to remove university", variant: "destructive" }),
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
        isSaved
          ? unsaveUniversity({ universityId })
          : saveUniversity({ data: { universityId } })
      }
      aria-label={isSaved ? "Remove saved university" : "Save university"}
    >
      {isSaved ? (
        <BookmarkCheck className="h-4 w-4 mr-2" />
      ) : (
        <Bookmark className="h-4 w-4 mr-2" />
      )}
      {isSaved ? "Saved" : "Save University"}
    </Button>
  );
}
