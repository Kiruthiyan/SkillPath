import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminMentors,
  useVerifyMentor,
  useInviteMentor,
  useCreateAdminMentor,
  useUpdateAdminMentor,
  type AdminMentorRow,
} from "@/api/mentors";
import { AdminLayout } from "./admin-layout";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  verified: "secondary",
  rejected: "destructive",
  suspended: "destructive",
};

type FormState = {
  email: string;
  name: string;
  headline: string;
  bio: string;
  expertiseAreas: string;
  yearsExperience: string;
  availability: string;
  isAcceptingStudents: boolean;
};

const emptyForm = (): FormState => ({
  email: "",
  name: "",
  headline: "",
  bio: "",
  expertiseAreas: "",
  yearsExperience: "",
  availability: "",
  isAcceptingStudents: true,
});

function parseExpertise(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function MentorFormFields({
  form,
  setForm,
  includeEmail,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  includeEmail: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {includeEmail && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="mentor-email">Email</Label>
          <Input
            id="mentor-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="mentor-name">Name</Label>
        <Input
          id="mentor-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mentor-years">Years experience</Label>
        <Input
          id="mentor-years"
          type="number"
          min={0}
          value={form.yearsExperience}
          onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="mentor-headline">Headline</Label>
        <Input
          id="mentor-headline"
          value={form.headline}
          onChange={(e) => setForm({ ...form, headline: e.target.value })}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="mentor-expertise">Expertise / guidance areas (comma-separated)</Label>
        <Input
          id="mentor-expertise"
          value={form.expertiseAreas}
          onChange={(e) => setForm({ ...form, expertiseAreas: e.target.value })}
          placeholder="Physical Science, Engineering"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="mentor-availability">Availability</Label>
        <Input
          id="mentor-availability"
          value={form.availability}
          onChange={(e) => setForm({ ...form, availability: e.target.value })}
          placeholder="Weekday evenings"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="mentor-bio">Background / bio</Label>
        <Textarea
          id="mentor-bio"
          rows={3}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={form.isAcceptingStudents}
          onChange={(e) => setForm({ ...form, isAcceptingStudents: e.target.checked })}
        />
        Accepting students (still requires verification before student-visible)
      </label>
    </div>
  );
}

export default function AdminMentors() {
  usePageTitle("Admin — Mentors");
  const { toast } = useToast();
  const [status, setStatus] = useState<string | undefined>("pending");
  const [search, setSearch] = useState("");
  const [expertiseFilter, setExpertiseFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(emptyForm);
  const [viewing, setViewing] = useState<AdminMentorRow | null>(null);
  const [editing, setEditing] = useState<AdminMentorRow | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [confirm, setConfirm] = useState<{
    id: number;
    action: "suspend" | "reject";
    label: string;
  } | null>(null);

  const { data: mentors, isLoading } = useAdminMentors(status);
  const { mutate: verify, isPending: isVerifying } = useVerifyMentor();
  const { mutate: invite, isPending: isInviting } = useInviteMentor();
  const { mutate: createMentor, isPending: isCreating } = useCreateAdminMentor();
  const { mutate: updateMentor, isPending: isUpdating } = useUpdateAdminMentor();

  const filtered = useMemo(() => {
    const rows = mentors ?? [];
    const q = search.trim().toLowerCase();
    const exp = expertiseFilter.trim().toLowerCase();
    const avail = availabilityFilter.trim().toLowerCase();
    return rows.filter((m) => {
      if (q) {
        const hay = `${m.name ?? ""} ${m.email} ${m.headline ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (exp) {
        const areas = (m.expertiseAreas ?? []).join(" ").toLowerCase();
        if (!areas.includes(exp)) return false;
      }
      if (avail) {
        if (!(m.availability ?? "").toLowerCase().includes(avail)) return false;
      }
      return true;
    });
  }, [mentors, search, expertiseFilter, availabilityFilter]);

  function submitInvite() {
    if (!inviteEmail) return;
    invite(
      { email: inviteEmail },
      {
        onSuccess: () => {
          toast({ title: "Invite sent", description: inviteEmail });
          setInviteEmail("");
        },
        onError: (err: any) =>
          toast({ title: "Could not send invite", description: err?.message, variant: "destructive" }),
      },
    );
  }

  function submitCreate() {
    if (!createForm.email || !createForm.name) return;
    createMentor(
      {
        email: createForm.email,
        name: createForm.name,
        headline: createForm.headline || null,
        bio: createForm.bio || null,
        expertiseAreas: parseExpertise(createForm.expertiseAreas),
        yearsExperience: createForm.yearsExperience ? Number(createForm.yearsExperience) : null,
        availability: createForm.availability || null,
        isAcceptingStudents: createForm.isAcceptingStudents,
      },
      {
        onSuccess: () => {
          toast({ title: "Mentor created", description: "Pending verification — not student-visible yet." });
          setCreateForm(emptyForm());
          setShowCreate(false);
          setStatus("pending");
        },
        onError: (err: any) =>
          toast({ title: "Could not create mentor", description: err?.message, variant: "destructive" }),
      },
    );
  }

  function openEdit(m: AdminMentorRow) {
    setEditing(m);
    setEditForm({
      email: m.email,
      name: m.name ?? "",
      headline: m.headline ?? "",
      bio: m.bio ?? "",
      expertiseAreas: (m.expertiseAreas ?? []).join(", "),
      yearsExperience: m.yearsExperience != null ? String(m.yearsExperience) : "",
      availability: m.availability ?? "",
      isAcceptingStudents: m.isAcceptingStudents,
    });
  }

  function submitEdit() {
    if (!editing || !editForm.name) return;
    updateMentor(
      {
        id: editing.id,
        data: {
          name: editForm.name,
          headline: editForm.headline || null,
          bio: editForm.bio || null,
          expertiseAreas: parseExpertise(editForm.expertiseAreas),
          yearsExperience: editForm.yearsExperience ? Number(editForm.yearsExperience) : null,
          availability: editForm.availability || null,
          isAcceptingStudents: editForm.isAcceptingStudents,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Mentor updated" });
          setEditing(null);
        },
        onError: (err: any) =>
          toast({ title: "Could not update mentor", description: err?.message, variant: "destructive" }),
      },
    );
  }

  function runVerify(id: number, next: "verified" | "rejected" | "suspended", activate?: boolean) {
    verify(
      { id, status: next, isAcceptingStudents: activate ? true : undefined },
      {
        onSuccess: () => toast({ title: `Mentor ${next}${activate ? " and activated" : ""}` }),
        onError: (err: any) =>
          toast({ title: "Could not update status", description: err?.message, variant: "destructive" }),
      },
    );
  }

  function activate(id: number) {
    updateMentor(
      { id, data: { isAcceptingStudents: true } },
      {
        onSuccess: () => toast({ title: "Mentor activated", description: "Now accepting students." }),
        onError: (err: any) =>
          toast({ title: "Could not activate", description: err?.message, variant: "destructive" }),
      },
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Invite mentor (path 2)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Input
              type="email"
              placeholder="mentor@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button size="sm" disabled={isInviting || !inviteEmail} onClick={submitInvite}>
              Invite Mentor
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Cancel create" : "Create Mentor"}
            </Button>
          </CardContent>
        </Card>

        {showCreate && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Create verified-ready mentor (starts pending)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MentorFormFields form={createForm} setForm={setCreateForm} includeEmail />
              <Button
                size="sm"
                disabled={isCreating || !createForm.email || !createForm.name}
                onClick={submitCreate}
              >
                Create as Pending
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search name / email / headline"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Input
            placeholder="Expertise"
            value={expertiseFilter}
            onChange={(e) => setExpertiseFilter(e.target.value)}
            className="max-w-[10rem]"
          />
          <Input
            placeholder="Availability"
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="max-w-[10rem]"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {["pending", "verified", "rejected", "suspended", undefined].map((s) => (
            <Button
              key={s ?? "all"}
              size="sm"
              variant={status === s ? "default" : "outline"}
              onClick={() => setStatus(s)}
            >
              {s ?? "All"}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mentors in this status.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Expertise</th>
                  <th className="p-3 font-medium">Experience</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Availability</th>
                  <th className="p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const canVerify = m.verificationStatus !== "verified";
                  const canActivate = m.verificationStatus === "verified" && !m.isAcceptingStudents;
                  const canSuspend = m.verificationStatus === "verified";
                  const canReject = m.verificationStatus !== "rejected";
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="p-3">
                        <div className="font-medium">{m.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-[14rem]">
                          {(m.expertiseAreas ?? []).length > 0
                            ? (m.expertiseAreas ?? []).map((a) => (
                                <Badge key={a} variant="secondary">
                                  {a}
                                </Badge>
                              ))
                            : "—"}
                        </div>
                      </td>
                      <td className="p-3">{m.yearsExperience != null ? `${m.yearsExperience}y` : "—"}</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant={STATUS_VARIANT[m.verificationStatus] ?? "outline"}>
                            {m.verificationStatus}
                          </Badge>
                          {m.verificationStatus === "verified" && (
                            <span className="text-xs text-muted-foreground">
                              {m.isAcceptingStudents ? "Accepting" : "Not accepting"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 max-w-[10rem] truncate">{m.availability || "—"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => setViewing(m)}>
                            View
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                            Edit
                          </Button>
                          {canVerify && (
                            <Button
                              size="sm"
                              disabled={isVerifying}
                              onClick={() => runVerify(m.id, "verified", true)}
                            >
                              Verify & Activate
                            </Button>
                          )}
                          {canActivate && (
                            <Button size="sm" disabled={isUpdating} onClick={() => activate(m.id)}>
                              Activate
                            </Button>
                          )}
                          {canSuspend && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isVerifying}
                              onClick={() => setConfirm({ id: m.id, action: "suspend", label: m.name || m.email })}
                            >
                              Suspend
                            </Button>
                          )}
                          {canReject && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isVerifying}
                              onClick={() => setConfirm({ id: m.id, action: "reject", label: m.name || m.email })}
                            >
                              Reject
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {viewing && (
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Mentor detail</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setViewing(null)}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Name:</span> {viewing.name}
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span> {viewing.email}
              </p>
              <p>
                <span className="text-muted-foreground">Headline:</span> {viewing.headline || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Bio:</span> {viewing.bio || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Expertise:</span>{" "}
                {(viewing.expertiseAreas ?? []).join(", ") || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Experience:</span>{" "}
                {viewing.yearsExperience != null ? `${viewing.yearsExperience} years` : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Availability:</span> {viewing.availability || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span> {viewing.verificationStatus} ·{" "}
                {viewing.isAcceptingStudents ? "accepting" : "not accepting"}
              </p>
              <p>
                <span className="text-muted-foreground">Active account:</span> {viewing.isActive ? "yes" : "no"}
              </p>
            </CardContent>
          </Card>
        )}

        {editing && (
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Edit mentor</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <MentorFormFields form={editForm} setForm={setEditForm} includeEmail={false} />
              <Button size="sm" disabled={isUpdating || !editForm.name} onClick={submitEdit}>
                Save changes
              </Button>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirm?.action === "suspend" ? "Suspend this mentor?" : "Reject this mentor?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirm?.label} will no longer be visible or bookable to students.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isVerifying}
                onClick={() => {
                  if (!confirm) return;
                  runVerify(confirm.id, confirm.action === "suspend" ? "suspended" : "rejected");
                  setConfirm(null);
                }}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <p className="text-xs text-muted-foreground">
          Students only see mentors that are <strong>verified</strong> and <strong>accepting</strong>.{" "}
          <Link href="/admin/overview" className="underline">
            Back to overview
          </Link>
        </p>
      </div>
    </AdminLayout>
  );
}
