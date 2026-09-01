import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePageTitle } from "@/hooks/use-page-title";
import { useListAdminProgrammes, useListAdminCutoffs, useUpdateAdminCutoff } from "@/api";
import { AdminLayout } from "./admin-layout";

export default function AdminZscoreData() {
  usePageTitle("Admin — Z-Score Data");
  const { data: programmes } = useListAdminProgrammes();
  const [programmeId, setProgrammeId] = useState<number | undefined>(undefined);
  const { data: cutoffs } = useListAdminCutoffs(programmeId);
  const { mutate: update } = useUpdateAdminCutoff();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftScore, setDraftScore] = useState("");

  return (
    <AdminLayout>
      <div className="space-y-4">
        <Select value={programmeId ? String(programmeId) : ""} onValueChange={(v) => setProgrammeId(Number(v))}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Select a programme" />
          </SelectTrigger>
          <SelectContent>
            {(programmes ?? []).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.degreeName}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {programmeId && (
          <div className="space-y-2">
            {(cutoffs ?? []).map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium">{c.district}</p>
                    <p className="text-xs text-muted-foreground">edition #{c.editionId} · page {c.sourcePage ?? "?"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{c.verifiedStatus}</Badge>
                    {editingId === c.id ? (
                      <>
                        <Input
                          className="w-24"
                          value={draftScore}
                          onChange={(e) => setDraftScore(e.target.value)}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            update({ id: c.id, data: { minimumZScore: Number(draftScore) } });
                            setEditingId(null);
                          }}
                        >
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="font-mono text-sm">{c.minimumZScore}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(c.id);
                            setDraftScore(String(c.minimumZScore));
                          }}
                        >
                          Edit
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {cutoffs?.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No cutoff records for this programme.</p>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
