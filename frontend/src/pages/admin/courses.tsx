import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { useListAdminProgrammes, useUpdateAdminProgramme } from "@/api";
import { AdminLayout } from "./admin-layout";

export default function AdminCourses() {
  usePageTitle("Admin — Courses");
  const { data: programmes, isLoading } = useListAdminProgrammes();
  const { mutate: update, isPending } = useUpdateAdminProgramme();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ degreeName: "", faculty: "", stream: "" });

  function startEdit(p: { id: number; degreeName: string; faculty: string; stream: string }) {
    setEditingId(p.id);
    setDraft({ degreeName: p.degreeName, faculty: p.faculty, stream: p.stream });
  }

  function save(id: number) {
    update({ id, data: draft }, { onSuccess: () => setEditingId(null) });
  }

  return (
    <AdminLayout>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {(programmes ?? []).map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4">
                {editingId === p.id ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input
                      value={draft.degreeName}
                      onChange={(e) => setDraft({ ...draft, degreeName: e.target.value })}
                      className="max-w-xs"
                    />
                    <Input
                      value={draft.faculty}
                      onChange={(e) => setDraft({ ...draft, faculty: e.target.value })}
                      className="max-w-xs"
                    />
                    <Input
                      value={draft.stream}
                      onChange={(e) => setDraft({ ...draft, stream: e.target.value })}
                      className="max-w-[12rem]"
                    />
                    <Button size="sm" disabled={isPending} onClick={() => save(p.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{p.degreeName}</p>
                      <p className="text-xs text-muted-foreground">{p.faculty}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{p.stream}</Badge>
                      <Badge variant="outline">{p.degreeType}</Badge>
                      <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Edit</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
