import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePageTitle } from "@/hooks/use-page-title";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/hooks/use-auth";
import {
  useAdminOpportunities,
  useCreateOpportunity,
  useDeleteOpportunity,
  useSetOpportunityStatus,
  type Opportunity,
  type OpportunityStatus,
  type OpportunityType,
} from "@/api/opportunities";
import { useMyUniversities } from "@/api/university-admin";
import { AdminLayout } from "./admin-layout";

const STATUS_TABS: { value: OpportunityStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_verification", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished" },
  { value: "archived", label: "Archived" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  pending_verification: "outline",
  verified: "secondary",
  published: "default",
  unpublished: "destructive",
  archived: "outline",
};

function nextActions(status: OpportunityStatus, isPrivileged: boolean): { label: string; to: OpportunityStatus }[] {
  if (!isPrivileged) {
    return status === "draft" ? [{ label: "Submit for Review", to: "pending_verification" }] : [];
  }
  switch (status) {
    case "draft":
      return [{ label: "Submit for Review", to: "pending_verification" }];
    case "pending_verification":
      return [{ label: "Verify", to: "verified" }];
    case "verified":
      return [{ label: "Publish", to: "published" }];
    case "published":
      return [{ label: "Unpublish", to: "unpublished" }, { label: "Archive", to: "archived" }];
    case "unpublished":
      return [{ label: "Publish", to: "published" }, { label: "Archive", to: "archived" }];
    default:
      return [];
  }
}

export default function AdminOpportunities() {
  usePageTitle("Admin — Opportunities");
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const isPrivileged = user?.role === "admin" || user?.role === "super_admin";
  const isUniversityAdmin = user?.role === "university_admin";

  const [statusTab, setStatusTab] = useState<OpportunityStatus | "all">("all");
  const { data: opportunities, isLoading } = useAdminOpportunities(statusTab === "all" ? undefined : statusTab);
  const { data: ownedUniversities } = useMyUniversities(isUniversityAdmin);
  const { mutate: create, isPending: isCreating } = useCreateOpportunity();
  const { mutate: remove } = useDeleteOpportunity();
  const { mutate: setStatus } = useSetOpportunityStatus();

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<{
    type: OpportunityType;
    title: string;
    description: string;
    organization: string;
    applicationUrl: string;
    amount: string;
    universityId: number | null;
  }>({
    type: "scholarship",
    title: "",
    description: "",
    organization: "",
    applicationUrl: "",
    amount: "",
    universityId: null,
  });

  useEffect(() => {
    if (!isUniversityAdmin || !ownedUniversities?.length) return;
    if (draft.universityId == null) {
      setDraft((d) => ({ ...d, universityId: ownedUniversities[0].id }));
    }
  }, [isUniversityAdmin, ownedUniversities, draft.universityId]);

  function submitCreate() {
    if (isUniversityAdmin && draft.universityId == null) {
      toast({
        title: "University required",
        description: "Select your university before creating an opportunity.",
        variant: "destructive",
      });
      return;
    }
    create(
      {
        type: draft.type,
        title: draft.title,
        description: draft.description,
        organization: draft.organization || null,
        applicationUrl: draft.applicationUrl || null,
        amount: draft.amount || null,
        universityId: draft.universityId,
      },
      {
        onSuccess: () => {
          setShowCreate(false);
          setDraft({
            type: "scholarship",
            title: "",
            description: "",
            organization: "",
            applicationUrl: "",
            amount: "",
            universityId: ownedUniversities?.[0]?.id ?? null,
          });
        },
        onError: (err: any) => toast({ title: "Could not create", description: err?.message, variant: "destructive" }),
      },
    );
  }

  function transition(o: Opportunity, to: OpportunityStatus) {
    setStatus(
      { id: o.id, status: to },
      { onError: (err: any) => toast({ title: "Could not change status", description: err?.message, variant: "destructive" }) },
    );
  }

  const createDisabled =
    isCreating ||
    !draft.title ||
    !draft.description ||
    (isUniversityAdmin && draft.universityId == null);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as OpportunityStatus | "all")}>
            <TabsList>
              {STATUS_TABS.map((s) => (
                <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Cancel" : "Add Opportunity"}
          </Button>
        </div>

        {showCreate && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as OpportunityType })}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["scholarship", "internship", "competition", "grant", "other"] as const).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Organization" value={draft.organization} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} />
                <Input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="sm:col-span-2" />
                <Input placeholder="Application URL" value={draft.applicationUrl} onChange={(e) => setDraft({ ...draft, applicationUrl: e.target.value })} />
                <Input placeholder="Amount (e.g. Full tuition)" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
                {isUniversityAdmin && (
                  <Select
                    value={draft.universityId != null ? String(draft.universityId) : undefined}
                    onValueChange={(v) => setDraft({ ...draft, universityId: Number(v) })}
                  >
                    <SelectTrigger className="h-10 text-sm sm:col-span-2">
                      <SelectValue placeholder="University" />
                    </SelectTrigger>
                    <SelectContent>
                      {(ownedUniversities ?? []).map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Textarea placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} />
              <Button size="sm" disabled={createDisabled} onClick={submitCreate}>Create Draft</Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (opportunities ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No opportunities in this status.</p>
        ) : (
          <div className="space-y-3">
            {(opportunities ?? []).map((o) => (
              <Card key={o.id}>
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{o.title}</p>
                      <Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>{o.status.replace(/_/g, " ")}</Badge>
                      <Badge variant="secondary">{o.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{o.organization ?? "—"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nextActions(o.status, !!isPrivileged).map((a) => (
                      <Button key={a.to} size="sm" onClick={() => transition(o, a.to)}>{a.label}</Button>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => remove(o.id)}>Delete</Button>
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
