import { motion } from "framer-motion";
import { Trophy, ArrowRight } from "lucide-react";

import { useListSuccessStories } from "@/api";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function SuccessStories() {
  const { t } = useTranslations();
  usePageTitle(t.stories.title);
  const { data: stories, isLoading, isError, refetch } = useListSuccessStories();

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.stories.title}</h1>
        <p className="text-muted-foreground mt-2">{t.stories.subtitle}</p>
      </div>

      {isError && <QueryError onRetry={() => refetch()} />}

      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {stories?.map((story, i) => (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                      style={{ backgroundColor: story.avatarColor ?? "#1e3a5f" }}
                    >
                      {story.name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle>{story.name}</CardTitle>
                      <CardDescription>
                        {story.degreeName} · {story.universityName} · {t.stories.classOf} {story.graduationYear}
                      </CardDescription>
                      <Badge variant="secondary" className="mt-2">{story.currentPosition}</Badge>
                    </div>
                    <Trophy className="h-6 w-6 text-primary ml-auto shrink-0" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {story.summary && (
                    <p className="text-muted-foreground leading-relaxed">{story.summary}</p>
                  )}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t.stories.careerJourney}</p>
                    {story.careerJourney.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && !stories?.length && (
        <p className="text-center text-muted-foreground py-12">{t.stories.noStories}</p>
      )}
    </div>
  );
}
