import { useEffect, useMemo, useState } from "react";
import { useSearch } from "wouter";
import { motion } from "framer-motion";
import { Briefcase, TrendingUp, DollarSign } from "lucide-react";

import { useListCareerPaths } from "@/api";
import { usePageTitle } from "@/hooks/use-page-title";
import { useTranslations } from "@/lib/i18n";
import { QueryError } from "@/components/query-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function getQueryParam(search: string, key: string): string | null {
  return new URLSearchParams(search).get(key);
}

export default function Careers() {
  const { t } = useTranslations();
  usePageTitle(t.careers.title);
  const search = useSearch();
  const degreeTypeParam = getQueryParam(search, "degreeType");

  const { data: careers, isLoading, isError, refetch } = useListCareerPaths(
    degreeTypeParam ? { degreeType: degreeTypeParam } : undefined,
  );

  const degreeTypes = useMemo(() => {
    if (!careers) return ["all"];
    const types = [...new Set(careers.map((c) => c.degreeType))].sort();
    return ["all", ...types];
  }, [careers]);

  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (degreeTypeParam && degreeTypes.includes(degreeTypeParam)) {
      setActiveTab(degreeTypeParam);
    }
  }, [degreeTypeParam, degreeTypes]);

  const filtered = useMemo(() => {
    if (!careers) return [];
    if (activeTab === "all") return careers;
    return careers.filter((c) => c.degreeType === activeTab);
  }, [careers, activeTab]);

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t.careers.title}</h1>
        <p className="text-muted-foreground mt-2">{t.careers.subtitle}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          {degreeTypes.map((type) => (
            <TabsTrigger key={type} value={type} className="capitalize">
              {type === "all" ? t.careers.allCategories : type}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isError && <QueryError onRetry={() => refetch()} />}
          {isLoading ? (
            <div className="grid sm:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid sm:grid-cols-2 gap-6"
            >
              {filtered.map((career) => (
                <Card key={career.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Briefcase className="h-6 w-6 text-primary" />
                      <Badge variant="outline">{career.degreeType}</Badge>
                    </div>
                    <CardTitle>{career.title}</CardTitle>
                    <CardDescription>{career.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      {t.careers.salaryEstimate}: LKR {career.salaryMin.toLocaleString()} – {career.salaryMax.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      {t.careers.growth}: {career.growthPotential} · {t.careers.demand}: {career.industryDemand}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          )}

          {!isLoading && filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">{t.careers.noCareersFound}</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
