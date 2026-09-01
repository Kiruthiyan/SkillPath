import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { useListHandbookBatches, useBulkApproveBatch } from "@/api";
import { AdminLayout } from "./admin-layout";

export default function AdminImports() {
  usePageTitle("Admin — Handbook Imports");
  const { data: batches, isLoading } = useListHandbookBatches();
  const { mutate: bulkApprove, isPending } = useBulkApproveBatch();

  return (
    <AdminLayout>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Batches are created by running <code className="text-xs">pnpm handbook:stage --year &lt;y&gt; --lang &lt;en|si|ta&gt;</code>{" "}
          against extracted staging JSON. Bulk approval promotes only pending clean rows; review-needed rows stay manual.
        </p>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {(batches ?? []).map((batch) => (
              <Card key={batch.id}>
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {batch.academicYear} — {batch.language.toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">{batch.sourceFileName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{batch.status}</Badge>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/review?batchId=${batch.id}`}>Review rows</Link>
                    </Button>
                    <Button
                      size="sm"
                      disabled={isPending || batch.status === "approved"}
                      onClick={() => bulkApprove(batch.id)}
                    >
                      Bulk approve clean rows
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {batches?.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No handbook batches staged yet.
              </p>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
