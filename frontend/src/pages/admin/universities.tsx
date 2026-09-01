import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { useListAdminUniversities, useUpdateAdminUniversity } from "@/api";
import { AdminLayout } from "./admin-layout";

export default function AdminUniversities() {
  usePageTitle("Admin — Universities");
  const { data: universities, isLoading } = useListAdminUniversities();
  const { mutate: update, isPending } = useUpdateAdminUniversity();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ name: "", shortName: "", location: "" });

  function startEdit(u: { id: number; name: string; shortName: string; location: string }) {
    setEditingId(u.id);
    setDraft({ name: u.name, shortName: u.shortName, location: u.location });
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
          {(universities ?? []).map((u) => (
            <Card key={u.id}>
              <CardContent className="p-4">
                {editingId === u.id ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="Name"
                      className="max-w-xs"
                    />
                    <Input
                      value={draft.shortName}
                      onChange={(e) => setDraft({ ...draft, shortName: e.target.value })}
                      placeholder="Short name"
                      className="max-w-[10rem]"
                    />
                    <Input
                      value={draft.location}
                      onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                      placeholder="Location"
                      className="max-w-[10rem]"
                    />
                    <Button size="sm" disabled={isPending} onClick={() => save(u.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.shortName} · {u.location}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => startEdit(u)}>Edit</Button>
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
