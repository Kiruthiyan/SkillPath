import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import {
  useMyUniversities,
  useUpdateMyUniversity,
  useMyAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useMyProgrammes,
  useUpdateMyProgramme,
  type OwnedUniversity,
  type OwnedProgramme,
} from "@/api";
import { UniversityAdminLayout } from "./layout";

function ProfileEditor({ university }: { university: OwnedUniversity }) {
  const { toast } = useToast();
  const { mutate: update, isPending } = useUpdateMyUniversity();
  const [draft, setDraft] = useState({
    contactEmail: university.contactEmail ?? "",
    contactPhone: university.contactPhone ?? "",
    website: university.website ?? "",
    address: university.address ?? "",
    description: university.description ?? "",
  });

  useEffect(() => {
    setDraft({
      contactEmail: university.contactEmail ?? "",
      contactPhone: university.contactPhone ?? "",
      website: university.website ?? "",
      address: university.address ?? "",
      description: university.description ?? "",
    });
  }, [university]);

  function save() {
    update(
      { id: university.id, data: draft },
      {
        onSuccess: () => toast({ title: "Profile updated" }),
        onError: (err: any) => toast({ title: "Could not save", description: err?.message, variant: "destructive" }),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{university.name}</CardTitle>
        <Badge variant="outline">{university.status.replace(/_/g, " ")}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="email"
            placeholder="Contact email"
            value={draft.contactEmail}
            onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
          />
          <Input
            placeholder="Contact phone"
            value={draft.contactPhone}
            onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
          />
          <Input
            placeholder="Website"
            value={draft.website}
            onChange={(e) => setDraft({ ...draft, website: e.target.value })}
          />
          <Input
            placeholder="Address"
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
          />
        </div>
        <Textarea
          placeholder="Description"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
        />
        <Button size="sm" disabled={isPending} onClick={save}>Save Profile</Button>
      </CardContent>
    </Card>
  );
}

function ProgrammeRow({ programme }: { programme: OwnedProgramme }) {
  const { toast } = useToast();
  const { mutate: update, isPending } = useUpdateMyProgramme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    degreeName: programme.degreeName,
    faculty: programme.faculty,
    degreeType: programme.degreeType,
    durationYears: programme.durationYears,
    description: programme.description ?? "",
  });

  function save() {
    update(
      { id: programme.id, data: draft },
      {
        onSuccess: () => {
          toast({ title: "Programme updated" });
          setEditing(false);
        },
        onError: (err: any) => toast({ title: "Could not save", description: err?.message, variant: "destructive" }),
      },
    );
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-md border border-[hsl(var(--border))] p-3">
        <div>
          <p className="font-medium text-sm">{programme.degreeName}</p>
          <p className="text-xs text-muted-foreground">
            {programme.faculty} · {programme.degreeType} · {programme.durationYears}y · {programme.stream}
          </p>
          {programme.description && <p className="text-xs text-muted-foreground mt-1">{programme.description}</p>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Degree name" value={draft.degreeName} onChange={(e) => setDraft({ ...draft, degreeName: e.target.value })} />
        <Input placeholder="Faculty" value={draft.faculty} onChange={(e) => setDraft({ ...draft, faculty: e.target.value })} />
        <Input placeholder="Degree type" value={draft.degreeType} onChange={(e) => setDraft({ ...draft, degreeType: e.target.value })} />
        <Input
          type="number"
          placeholder="Duration (years)"
          value={draft.durationYears}
          onChange={(e) => setDraft({ ...draft, durationYears: Number(e.target.value) })}
        />
      </div>
      <Textarea placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} />
      <div className="flex gap-2">
        <Button size="sm" disabled={isPending} onClick={save}>Save</Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function ProgrammesPanel({ universityId }: { universityId: number }) {
  const { data: programmes, isLoading } = useMyProgrammes();
  const ownProgrammes = (programmes ?? []).filter((p) => p.universityId === universityId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Degree Programmes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : ownProgrammes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No programmes listed yet.</p>
        ) : (
          ownProgrammes.map((p) => <ProgrammeRow key={p.id} programme={p} />)
        )}
      </CardContent>
    </Card>
  );
}

function AnnouncementsPanel({ universityId }: { universityId: number }) {
  const { toast } = useToast();
  const { data: announcements, isLoading } = useMyAnnouncements(universityId);
  const { mutate: create, isPending: isCreating } = useCreateAnnouncement();
  const { mutate: remove } = useDeleteAnnouncement();
  const [draft, setDraft] = useState({ title: "", body: "", link: "" });

  function submit() {
    if (!draft.title || !draft.body) return;
    create(
      { universityId, title: draft.title, body: draft.body, link: draft.link || null },
      {
        onSuccess: () => setDraft({ title: "", body: "", link: "" }),
        onError: (err: any) => toast({ title: "Could not post", description: err?.message, variant: "destructive" }),
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Announcements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 border-b border-[hsl(var(--border))] pb-4">
          <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Textarea placeholder="Body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={2} />
          <Input placeholder="Link (optional)" value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} />
          <Button size="sm" disabled={isCreating || !draft.title || !draft.body} onClick={submit}>Post Announcement</Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="space-y-2">
            {(announcements ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            )}
            {(announcements ?? []).map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-md border border-[hsl(var(--border))] p-3">
                <div>
                  <p className="font-medium text-sm">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.body}</p>
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      {a.link}
                    </a>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>Delete</Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function UniversityAdminDashboard() {
  usePageTitle("University Dashboard");
  const { data: universities, isLoading } = useMyUniversities();

  return (
    <UniversityAdminLayout>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (universities ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You are not yet assigned to a university. Contact a platform admin.
        </p>
      ) : (
        <div className="space-y-6">
          {(universities ?? []).map((u) => (
            <div key={u.id} className="space-y-4">
              <ProfileEditor university={u} />
              <ProgrammesPanel universityId={u.id} />
              <AnnouncementsPanel universityId={u.id} />
            </div>
          ))}
        </div>
      )}
    </UniversityAdminLayout>
  );
}
