import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UGC_DISTRICTS } from "@/hooks/use-profile";
import { useListCheckerAcademicYears, useListCheckerStreams, useListCheckerSubjects } from "@/api";

const GRADES = ["A", "B", "C", "S", "F"];

export interface CheckerFormValue {
  academicYear: string;
  stream: string;
  district: string;
  zscore: string;
  subjectGrades: { subject: string; grade: string }[];
}

export function CheckerForm({
  value,
  onChange,
}: {
  value: CheckerFormValue;
  onChange: (value: CheckerFormValue) => void;
}) {
  const { data: streams } = useListCheckerStreams();
  const { data: subjects } = useListCheckerSubjects();
  const { data: academicYears } = useListCheckerAcademicYears();

  function updateSubjectRow(index: number, patch: Partial<{ subject: string; grade: string }>) {
    const rows = value.subjectGrades.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange({ ...value, subjectGrades: rows });
  }

  function addSubjectRow() {
    onChange({ ...value, subjectGrades: [...value.subjectGrades, { subject: "", grade: "" }] });
  }

  function removeSubjectRow(index: number) {
    onChange({ ...value, subjectGrades: value.subjectGrades.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 space-y-1.5">
          <Label>Academic Year</Label>
          <Select
            value={value.academicYear}
            onValueChange={(academicYear) => onChange({ ...value, academicYear })}
          >
            <SelectTrigger className="min-w-0">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {(academicYears ?? []).map((year) => (
                <SelectItem key={year.academicYear} value={year.academicYear}>
                  {year.academicYear}
                  {year.handbookAvailable ? "" : " (estimate)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label>A/L Stream</Label>
          <Select value={value.stream} onValueChange={(stream) => onChange({ ...value, stream })}>
            <SelectTrigger className="min-w-0">
              <SelectValue placeholder="Select stream" />
            </SelectTrigger>
            <SelectContent>
              {(streams ?? []).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label>District (Z-score quota)</Label>
          <Select value={value.district} onValueChange={(district) => onChange({ ...value, district })}>
            <SelectTrigger className="min-w-0">
              <SelectValue placeholder="Select district" />
            </SelectTrigger>
            <SelectContent>
              {UGC_DISTRICTS.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label>Your Z-Score</Label>
          <Input
            type="number"
            step="0.001"
            placeholder="e.g. 1.850"
            value={value.zscore}
            onChange={(e) => onChange({ ...value, zscore: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Subjects &amp; Grades</Label>
        {value.subjectGrades.map((row, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_2.5rem] sm:items-start">
            <Select value={row.subject} onValueChange={(subject) => updateSubjectRow(i, { subject })}>
              <SelectTrigger className="col-span-2 min-w-0 sm:col-span-1">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={row.grade} onValueChange={(grade) => updateSubjectRow(i, { grade })}>
              <SelectTrigger className="min-w-0">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => removeSubjectRow(i)}
              aria-label="Remove subject"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addSubjectRow}>
          <Plus className="h-4 w-4 mr-1" /> Add subject
        </Button>
      </div>
    </div>
  );
}
