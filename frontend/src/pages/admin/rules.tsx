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
import {
  useListAdminProgrammes,
  useListAdminSubjectRequirements,
  useCreateAdminSubjectRequirement,
  useDeleteAdminSubjectRequirement,
  useListAdminAdmissionRules,
  useCreateAdminAdmissionRule,
  useDeleteAdminAdmissionRule,
} from "@/api";
import { AdminLayout } from "./admin-layout";

export default function AdminRules() {
  usePageTitle("Admin — Rules");
  const { data: programmes } = useListAdminProgrammes();
  const [programmeId, setProgrammeId] = useState<number | undefined>(undefined);

  const { data: requirements } = useListAdminSubjectRequirements(programmeId);
  const { mutate: createRequirement } = useCreateAdminSubjectRequirement();
  const { mutate: deleteRequirement } = useDeleteAdminSubjectRequirement();

  const { data: rules } = useListAdminAdmissionRules(programmeId);
  const { mutate: createRule } = useCreateAdminAdmissionRule();
  const { mutate: deleteRule } = useDeleteAdminAdmissionRule();

  const [newSubject, setNewSubject] = useState({ subjectName: "", minimumGrade: "", requirementType: "compulsory", groupKey: "default" });
  const [newRule, setNewRule] = useState({ ruleType: "other", description: "" });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Select value={programmeId ? String(programmeId) : ""} onValueChange={(v) => setProgrammeId(Number(v))}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder="Select a programme to manage rules for" />
          </SelectTrigger>
          <SelectContent>
            {(programmes ?? []).map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.degreeName}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {programmeId && (
          <>
            <Card>
              <CardContent className="p-4 space-y-3">
                <h2 className="font-medium">Subject Requirements</h2>
                {(requirements ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {r.requirementType} · {r.subjectName} {r.minimumGrade && `(min ${r.minimumGrade})`}{" "}
                      <Badge variant="outline" className="ml-1">{r.groupKey}</Badge>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => deleteRequirement(r.id)}>Remove</Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-[hsl(var(--border))]">
                  <Select value={newSubject.requirementType} onValueChange={(v) => setNewSubject({ ...newSubject, requirementType: v })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compulsory">compulsory</SelectItem>
                      <SelectItem value="one_of">one_of</SelectItem>
                      <SelectItem value="recommended">recommended</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Group key" className="w-32" value={newSubject.groupKey} onChange={(e) => setNewSubject({ ...newSubject, groupKey: e.target.value })} />
                  <Input placeholder="Subject name" className="w-48" value={newSubject.subjectName} onChange={(e) => setNewSubject({ ...newSubject, subjectName: e.target.value })} />
                  <Input placeholder="Min grade" className="w-24" value={newSubject.minimumGrade} onChange={(e) => setNewSubject({ ...newSubject, minimumGrade: e.target.value })} />
                  <Button
                    size="sm"
                    onClick={() =>
                      createRequirement({
                        programmeId,
                        requirementType: newSubject.requirementType as "compulsory" | "one_of" | "recommended",
                        groupKey: newSubject.groupKey || "default",
                        subjectName: newSubject.subjectName,
                        minimumGrade: newSubject.minimumGrade || null,
                        sourceEditionId: null,
                        sourcePage: null,
                      })
                    }
                    disabled={!newSubject.subjectName}
                  >
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <h2 className="font-medium">Admission Rules</h2>
                {(rules ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {r.ruleType}: {r.description} {r.blocksEligibility ? "" : "(informational)"}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => deleteRule(r.id)}>Remove</Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-[hsl(var(--border))]">
                  <Input placeholder="Rule type" className="w-40" value={newRule.ruleType} onChange={(e) => setNewRule({ ...newRule, ruleType: e.target.value })} />
                  <Input placeholder="Description" className="w-64" value={newRule.description} onChange={(e) => setNewRule({ ...newRule, description: e.target.value })} />
                  <Button
                    size="sm"
                    onClick={() =>
                      createRule({
                        programmeId,
                        ruleType: newRule.ruleType,
                        description: newRule.description,
                        blocksEligibility: true,
                        sourceEditionId: null,
                        sourcePage: null,
                      })
                    }
                    disabled={!newRule.description}
                  >
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
