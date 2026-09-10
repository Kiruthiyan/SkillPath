import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import {
  useListAdminUniversities,
  useUpdateAdminUniversity,
  useCreateAdminUniversity,
  useSetUniversityStatus,
  useInviteUniversityAdmin,
} from "@/api";
import { AdminLayout } from "./admin-layout";

const STATUS_OPTIONS = ["pending_verification", "verified", "published", "suspended", "archived"] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending_verification: "outline",
  verified: "secondary",
  published: "default",
  suspended: "destructive",
  archived: "outline",
};

export default function AdminUniversities() {
  usePageTitle("Admin — Universities");
  const { toast } = useToast();
  const { data: universities, isLoading } = useListAdminUniversities();
  const { mutate: update, isPending } = useUpdateAdminUniversity();
  const { mutate: create, isPending: isCreating } = useCreateAdminUniversity();
  const { mutate: setStatus } = useSetUniversityStatus();
  const { mutate: invite, isPending: isInviting } = useInviteUniversityAdmin();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ name: "", shortName: "", location: "" });
  const [invitingId, setInvitingId] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newUniversity, setNewUniversity] = useState({
    name: "",
    shortName: "",
    location: "",
    foundedYear: new Date().getFullYear(),
    logoColor: "#2563eb",
    ranking: 1,
  });

  function startEdit(u: { id: number; name: string; shortName: string; location: string }) {
    setEditingId(u.id);
    setDraft({ name: u.name, shortName: u.shortName, location: u.location });
  }

  function save(id: number) {
    update({ id, data: draft }, { onSuccess: () => setEditingId(null) });
  }

  function submitInvite(universityId: number) {
    if (!inviteEmail) return;
    invite(
      { email: inviteEmail, universityId },
      {
        onSuccess: () => {
          toast({ title: "Invite sent", description: inviteEmail });
          setInvitingId(null);
          setInviteEmail("");
        },
        onError: (err: any) => {
          toast({ title: "Could not send invite", description: err?.message, variant: "destructive" });
        },
      },
    );
  }

  function submitCreate() {
    create(newUniversity, {
      onSuccess: () => {
        setShowCreate(false);
        setNewUniversity({ name: "", shortName: "", location: "", foundedYear: new Date().getFullYear(), logoColor: "#2563eb", ranking: 1 });
      },
      onError: (err: any) => {
        toast({ title: "Could not create university", description: err?.message, variant: "destructive" });
      },
    });
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            New universities start as <code>pending_verification</code> until you verify and publish them.
          </p>
          <Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "Add University"}
          </Button>
        </div>

        {showCreate && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={newUniversity.name} onChange={(e) => setNewUniversity({ ...newUniversity, name: e.target.value })} />
                <Input placeholder="Short name" value={newUniversity.shortName} onChange={(e) => setNewUniversity({ ...newUniversity, shortName: e.target.value })} />
                <Input placeholder="Location" value={newUniversity.location} onChange={(e) => setNewUniversity({ ...newUniversity, location: e.target.value })} />
                <Input
                  type="number"
                  placeholder="Founded year"
                  value={newUniversity.foundedYear}
                  onChange={(e) => setNewUniversity({ ...newUniversity, foundedYear: Number(e.target.value) })}
                />
                <Input placeholder="Logo color (hex)" value={newUniversity.logoColor} onChange={(e) => setNewUniversity({ ...newUniversity, logoColor: e.target.value })} />
                <Input
                  type="number"
                  placeholder="Ranking"
                  value={newUniversity.ranking}
                  onChange={(e) => setNewUniversity({ ...newUniversity, ranking: Number(e.target.value) })}
                />
              </div>
              <Button
                size="sm"
                disabled={isCreating || !newUniversity.name || !newUniversity.shortName || !newUniversity.location}
                onClick={submitCreate}
              >
                Create
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {(universities ?? []).map((u) => (
              <Card key={u.id}>
                <CardContent className="p-4 space-y-3">
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{u.name}</p>
                          <Badge variant={STATUS_VARIANT[u.status] ?? "outline"}>{u.status.replace(/_/g, " ")}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{u.shortName} · {u.location}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={u.status} onValueChange={(status) => setStatus({ id: u.id, status })}>
                          <SelectTrigger className="h-8 w-[11rem] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" onClick={() => setInvitingId(invitingId === u.id ? null : u.id)}>
                          Invite Admin
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEdit(u)}>Edit</Button>
                      </div>
                    </div>
                  )}

                  {invitingId === u.id && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))] pt-3">
                      <Input
                        type="email"
                        placeholder="university.admin@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button size="sm" disabled={isInviting || !inviteEmail} onClick={() => submitInvite(u.id)}>
                        Send Invite
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
