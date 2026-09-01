import { useMemo, useState } from "react";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { useListExtractedRows, useApproveExtractedRow, useRejectExtractedRow } from "@/api";
import { AdminLayout } from "./admin-layout";

export default function AdminReviewQueue() {
  usePageTitle("Admin — Extracted Data Review");
  const search = useSearch();
  const batchId = useMemo(() => {
    const params = new URLSearchParams(search);
    const value = params.get("batchId");
    return value ? Number(value) : undefined;
  }, [search]);

  const [statusFilter, setStatusFilter] = useState("pending");
  const [corrections, setCorrections] = useState<Record<number, Record<string, string>>>({});
  const { data: rows, isLoading } = useListExtractedRows({ batchId, status: statusFilter || undefined });
  const { mutate: approve } = useApproveExtractedRow();
  const { mutate: reject } = useRejectExtractedRow();

  function updateCorrection(rowId: number, field: string, value: string) {
    setCorrections((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] ?? {}),
        [field]: value,
      },
    }));
  }

  function correctionValue(
    row: NonNullable<typeof rows>[number],
    field: string,
    fallback: string | number | null,
  ) {
    return corrections[row.id]?.[field] ?? (fallback == null ? "" : String(fallback));
  }

  function approveRow(row: NonNullable<typeof rows>[number]) {
    if (row.verificationStatus !== "needs_review") {
      approve({ id: row.id });
      return;
    }

    const zscore = correctionValue(row, "minimumZScore", row.correctedMinimumZScore ?? row.minimumZScore);
    approve({
      id: row.id,
      corrections: {
        university: correctionValue(row, "university", row.correctedUniversityName ?? row.rawUniversityName),
        degreeName: correctionValue(row, "degreeName", row.correctedDegreeName ?? row.rawDegreeName),
        faculty: correctionValue(row, "faculty", row.correctedFaculty ?? row.faculty),
        stream: correctionValue(row, "stream", row.correctedStream ?? row.stream),
        district: correctionValue(row, "district", row.correctedDistrict ?? row.district),
        minimumZScore: zscore ? Number(zscore) : undefined,
      },
    });
  }

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const row of rows ?? []) {
      const key = row.matchedCanonicalKey ?? `row-${row.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex gap-2">
          {["pending", "approved", "rejected", "edited", ""].map((s) => (
            <Button
              key={s || "all"}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
            >
              {s || "all"}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([key, groupRows]) => (
              <Card key={key}>
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs text-muted-foreground break-all">{key}</p>
                  {(groupRows ?? []).map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border))] pt-2 first:border-t-0 first:pt-0"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {row.correctedDegreeName ?? row.rawDegreeName} — {row.correctedUniversityName ?? row.rawUniversityName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.stream} · {row.district} · Z={row.correctedMinimumZScore ?? row.minimumZScore} · page {row.sourcePage ?? "?"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{row.status}</Badge>
                        <Badge variant={row.verificationStatus === "needs_review" ? "secondary" : "outline"}>
                          {row.verificationStatus}
                        </Badge>
                        {row.status === "pending" && (
                          <>
                            <Button size="sm" onClick={() => approveRow(row)}>
                              {row.verificationStatus === "needs_review" ? "Approve corrected" : "Approve"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => reject({ id: row.id })}>
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                      {row.status === "pending" && row.verificationStatus === "needs_review" && (
                        <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-2 basis-full">
                          <Input
                            value={correctionValue(row, "university", row.correctedUniversityName ?? row.rawUniversityName)}
                            onChange={(event) => updateCorrection(row.id, "university", event.target.value)}
                          />
                          <Input
                            value={correctionValue(row, "degreeName", row.correctedDegreeName ?? row.rawDegreeName)}
                            onChange={(event) => updateCorrection(row.id, "degreeName", event.target.value)}
                          />
                          <Input
                            value={correctionValue(row, "faculty", row.correctedFaculty ?? row.faculty)}
                            onChange={(event) => updateCorrection(row.id, "faculty", event.target.value)}
                          />
                          <Input
                            value={correctionValue(row, "stream", row.correctedStream ?? row.stream)}
                            onChange={(event) => updateCorrection(row.id, "stream", event.target.value)}
                          />
                          <Input
                            value={correctionValue(row, "district", row.correctedDistrict ?? row.district)}
                            onChange={(event) => updateCorrection(row.id, "district", event.target.value)}
                          />
                          <Input
                            type="number"
                            step="0.001"
                            value={correctionValue(row, "minimumZScore", row.correctedMinimumZScore ?? row.minimumZScore)}
                            onChange={(event) => updateCorrection(row.id, "minimumZScore", event.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
            {grouped.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No extracted rows match this filter.</p>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
