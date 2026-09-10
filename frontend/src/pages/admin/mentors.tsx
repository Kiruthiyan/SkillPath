import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { useAdminMentors, useVerifyMentor, useInviteMentor } from "@/api/mentors";
import { AdminLayout } from "./admin-layout";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  verified: "secondary",
  rejected: "destructive",
  suspended: "destructive",
};

export default function AdminMentors() {
  usePageTitle("Admin — Mentors");
  const { toast } = useToast();
  const [status, setStatus] = useState<string | undefined>("pending");
  const { data: mentors, isLoading } = useAdminMentors(status);
  const { mutate: verify } = useVerifyMentor();
  const { mutate: invite, isPending: isInviting } = useInviteMentor();
  const [inviteEmail, setInviteEmail] = useState("");

  function submitInvite() {
    if (!inviteEmail) return;
    invite(
      { email: inviteEmail },
      {
        onSuccess: () => {
          toast({ title: "Invite sent", description: inviteEmail });
          setInviteEmail("");
        },
        onError: (err: any) => toast({ title: "Could not send invite", description: err?.message, variant: "destructive" }),
      },
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-2">
            <Input
              type="email"
              placeholder="mentor@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button size="sm" disabled={isInviting || !inviteEmail} onClick={submitInvite}>Invite Mentor</Button>
          </CardContent>
        </Card>

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
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (mentors ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No mentors in this status.</p>
        ) : (
          <div className="space-y-3">
            {(mentors ?? []).map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{m.name}</p>
                      <Badge variant={STATUS_VARIANT[m.verificationStatus] ?? "outline"}>{m.verificationStatus}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{m.email} · {m.headline ?? "No headline"}</p>
                  </div>
                  <div className="flex gap-2">
                    {m.verificationStatus !== "verified" && (
                      <Button size="sm" onClick={() => verify({ id: m.id, status: "verified" })}>Verify</Button>
                    )}
                    {m.verificationStatus !== "rejected" && (
                      <Button size="sm" variant="outline" onClick={() => verify({ id: m.id, status: "rejected" })}>Reject</Button>
                    )}
                    {m.verificationStatus === "verified" && (
                      <Button size="sm" variant="destructive" onClick={() => verify({ id: m.id, status: "suspended" })}>Suspend</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
