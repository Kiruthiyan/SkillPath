import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/hooks/use-auth";
import { useListMentors, useRequestMentor, useMyOutgoingMentorRequests } from "@/api/mentors";

const LIVE_REQUEST_STATUSES = new Set(["requested", "accepted", "active"]);

function RequestDialog({ mentorId, onClose }: { mentorId: number; onClose: () => void }) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const { mutate: request, isPending } = useRequestMentor();

  function submit() {
    request(
      { mentorId, message: message || undefined },
      {
        onSuccess: () => {
          toast({ title: "Request sent", description: "The mentor will review your request." });
          onClose();
        },
        onError: (err: any) => {
          toast({ title: "Could not send request", description: err?.message, variant: "destructive" });
        },
      },
    );
  }

  return (
    <div className="mt-3 space-y-2 border-t border-[hsl(var(--border))] pt-3">
      <Textarea
        placeholder="Tell this mentor a bit about what you're looking for (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={isPending} onClick={submit}>Send Request</Button>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function Mentors() {
  usePageTitle("Find a Mentor");
  const token = useAuthStore((s) => s.token);
  const [search, setSearch] = useState("");
  const [stream, setStream] = useState("");
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const { data: mentors, isLoading, isError } = useListMentors({ search: search || undefined, stream: stream || undefined });
  const { data: myRequests } = useMyOutgoingMentorRequests();

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Find a Mentor</h1>
        <p className="text-sm text-muted-foreground">Browse verified mentors and request guidance.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by name or headline"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Filter by expertise / stream"
          value={stream}
          onChange={(e) => setStream(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Could not load mentors. Please try again.</p>
      ) : (mentors ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No mentors found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(mentors ?? []).map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4 space-y-2">
                <div>
                  <p className="font-medium">{m.name}</p>
                  {m.headline && <p className="text-sm text-muted-foreground">{m.headline}</p>}
                </div>
                {m.bio && <p className="text-sm">{m.bio}</p>}
                <div className="flex flex-wrap gap-1">
                  {(m.expertiseAreas ?? []).map((a) => (
                    <Badge key={a} variant="secondary">{a}</Badge>
                  ))}
                </div>
                {m.yearsExperience != null && (
                  <p className="text-xs text-muted-foreground">{m.yearsExperience} years experience</p>
                )}

                {(() => {
                  const existing = myRequests?.find(
                    (r) => r.mentorUserId === m.userId && LIVE_REQUEST_STATUSES.has(r.status),
                  );
                  if (existing) {
                    return <Badge variant="outline">Request {existing.status}</Badge>;
                  }
                  if (!token) {
                    return <p className="text-xs text-muted-foreground">Sign in to request mentorship.</p>;
                  }
                  return requestingId === m.id ? (
                    <RequestDialog mentorId={m.id} onClose={() => setRequestingId(null)} />
                  ) : (
                    <Button size="sm" onClick={() => setRequestingId(m.id)}>Request Mentorship</Button>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
