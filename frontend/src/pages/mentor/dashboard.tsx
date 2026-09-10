import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import {
  useMyMentorProfile,
  useUpdateMyMentorProfile,
  useMentorIncomingRequests,
  useRespondToMentorRequest,
} from "@/api/mentors";
import { MentorLayout } from "./layout";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  verified: "secondary",
  rejected: "destructive",
  suspended: "destructive",
};

function ProfileEditor() {
  const { toast } = useToast();
  const { data: profile, isLoading } = useMyMentorProfile();
  const { mutate: update, isPending } = useUpdateMyMentorProfile();

  const [draft, setDraft] = useState({
    headline: "",
    bio: "",
    expertiseAreas: "",
    yearsExperience: "",
    availability: "",
    isAcceptingStudents: true,
  });

  useEffect(() => {
    if (!profile) return;
    setDraft({
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
      expertiseAreas: (profile.expertiseAreas ?? []).join(", "),
      yearsExperience: profile.yearsExperience != null ? String(profile.yearsExperience) : "",
      availability: profile.availability ?? "",
      isAcceptingStudents: profile.isAcceptingStudents,
    });
  }, [profile]);

  function save() {
    update(
      {
        headline: draft.headline || null,
        bio: draft.bio || null,
        expertiseAreas: draft.expertiseAreas
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        yearsExperience: draft.yearsExperience ? Number(draft.yearsExperience) : null,
        availability: draft.availability || null,
        isAcceptingStudents: draft.isAcceptingStudents,
      },
      {
        onSuccess: () => toast({ title: "Profile saved" }),
        onError: (err: any) => toast({ title: "Could not save", description: err?.message, variant: "destructive" }),
      },
    );
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Your Mentor Profile</CardTitle>
        {profile && (
          <Badge variant={STATUS_VARIANT[profile.verificationStatus] ?? "outline"}>
            {profile.verificationStatus}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {profile?.verificationStatus === "pending" && (
          <p className="text-sm text-muted-foreground">
            Your profile is awaiting admin verification. You won't appear publicly until verified.
          </p>
        )}
        <Input
          placeholder="Headline (e.g. Senior Software Engineer @ Acme)"
          value={draft.headline}
          onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
        />
        <Textarea
          placeholder="Bio"
          value={draft.bio}
          onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
          rows={3}
        />
        <Input
          placeholder="Expertise areas, comma separated (e.g. Software Engineering, Data Science)"
          value={draft.expertiseAreas}
          onChange={(e) => setDraft({ ...draft, expertiseAreas: e.target.value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="number"
            placeholder="Years of experience"
            value={draft.yearsExperience}
            onChange={(e) => setDraft({ ...draft, yearsExperience: e.target.value })}
          />
          <Input
            placeholder="Availability (e.g. Weekends, 2 hrs/week)"
            value={draft.availability}
            onChange={(e) => setDraft({ ...draft, availability: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={draft.isAcceptingStudents}
            onCheckedChange={(checked) => setDraft({ ...draft, isAcceptingStudents: checked })}
          />
          <span className="text-sm">Accepting new students</span>
        </div>
        <Button size="sm" disabled={isPending} onClick={save}>Save Profile</Button>
      </CardContent>
    </Card>
  );
}

function RequestsPanel() {
  const { toast } = useToast();
  const { data: requests, isLoading } = useMentorIncomingRequests();
  const { mutate: respond } = useRespondToMentorRequest();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Student Requests</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (requests ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          (requests ?? []).map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 rounded-md border border-[hsl(var(--border))] p-3">
              <div>
                <p className="font-medium text-sm">{r.studentName}</p>
                {r.message && <p className="text-xs text-muted-foreground">{r.message}</p>}
                <Badge variant="outline" className="mt-1">{r.status}</Badge>
              </div>
              {r.status === "requested" && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      respond(
                        { id: r.id, status: "accepted" },
                        { onSuccess: () => toast({ title: "Request accepted" }) },
                      )
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      respond(
                        { id: r.id, status: "declined" },
                        { onSuccess: () => toast({ title: "Request declined" }) },
                      )
                    }
                  >
                    Decline
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function MentorDashboard() {
  usePageTitle("Mentor Dashboard");
  return (
    <MentorLayout>
      <div className="space-y-6">
        <ProfileEditor />
        <RequestsPanel />
      </div>
    </MentorLayout>
  );
}
