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
import { useListCheckerAcademicYears, useListCheckerStreams } from "@/api";
import { useTranslations } from "@/lib/i18n";

const GRADES = ["A", "B", "C", "S", "F"];

/**
 * Official A/L subjects by stream.
 * Source: UGC University Admissions Handbook, stream eligibility tables.
 * These are the subjects that appear in the handbook as eligible subjects
 * for each stream. When the database has no subjects for a programme,
 * these values populate the subject picker for that stream.
 * Note: This list is for UI selection only — the eligibility engine uses
 * the database-driven subject requirements, not this list.
 */
const STREAM_SUBJECTS: Record<string, string[]> = {
  "Physical Science": [
    "Combined Mathematics",
    "Physics",
    "Chemistry",
    "Further Mathematics",
    "Information and Communication Technology",
  ],
  "Biological Science": [
    "Biology",
    "Chemistry",
    "Physics",
    "Agriculture",
    "Combined Mathematics",
  ],
  "Technology": [
    "Engineering Technology",
    "Bio Systems Technology",
    "Science for Technology",
    "Information and Communication Technology",
  ],
  "Engineering Technology": [
    "Engineering Technology",
    "Science for Technology",
    "Combined Mathematics",
    "Information and Communication Technology",
  ],
  "Biosystems Technology": [
    "Bio Systems Technology",
    "Science for Technology",
    "Agriculture",
    "Information and Communication Technology",
  ],
  "Commerce": [
    "Business Studies",
    "Accounting",
    "Economics",
    "Business Statistics",
    "Information and Communication Technology",
  ],
  "Arts": [
    "Political Science",
    "History",
    "Geography",
    "Economics",
    "Sinhala",
    "Tamil",
    "English",
    "Western Music",
    "Eastern Music",
    "Oriental Languages",
    "Western Classical Culture",
    "Greek & Roman Civilization",
    "Media Studies",
    "Drama & Theatre",
    "Dancing",
    "Logic and Scientific Method",
    "Home Economics",
    "Communication & Media Studies",
    "Aesthetics",
    "Buddhism",
    "Hinduism",
    "Islam",
    "Christianity",
  ],
};

/** Returns the canonical subject list for a stream, or an empty array if stream is unknown. */
function subjectsForStream(stream: string): string[] {
  return STREAM_SUBJECTS[stream] ?? [];
}

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
  const { t } = useTranslations();
  const { data: streams } = useListCheckerStreams();
  const { data: academicYears } = useListCheckerAcademicYears();

  // Subject list for current stream.
  // D.1: Each stream gets its correct official subject list.
  const availableSubjects = subjectsForStream(value.stream);

  function handleStreamChange(stream: string) {
    // D.2: Changing stream resets subject selections AND stale results (handled in parent).
    onChange({ ...value, stream, subjectGrades: [] });
  }

  function updateSubjectRow(index: number, patch: Partial<{ subject: string; grade: string }>) {
    const rows = value.subjectGrades.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange({ ...value, subjectGrades: rows });
  }

  function addSubjectRow() {
    // Only add if the current stream has subjects available
    if (availableSubjects.length === 0) return;
    onChange({ ...value, subjectGrades: [...value.subjectGrades, { subject: "", grade: "" }] });
  }

  function removeSubjectRow(index: number) {
    onChange({ ...value, subjectGrades: value.subjectGrades.filter((_, i) => i !== index) });
  }

  // D.3: Determine which subjects are already selected to prevent duplicates in the picker.
  const selectedSubjects = new Set(
    value.subjectGrades.map((r) => r.subject).filter(Boolean),
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 space-y-1.5">
          <Label>{t.checker.academicYear}</Label>
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
          <Label>{t.checker.stream}</Label>
          {/* D.2: Stream change now resets subjects via handleStreamChange */}
          <Select value={value.stream} onValueChange={handleStreamChange}>
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
          <Label>{t.checker.district}</Label>
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
          <Label>{t.checker.zscore}</Label>
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
        <Label>{t.checker.subjectGrades}</Label>

        {value.stream && availableSubjects.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No subject list available for stream &ldquo;{value.stream}&rdquo; — subject-based filtering is not available for this stream.
          </p>
        )}

        {value.subjectGrades.map((row, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_2.5rem] sm:items-start">
            <Select value={row.subject} onValueChange={(subject) => updateSubjectRow(i, { subject })}>
              <SelectTrigger className="col-span-2 min-w-0 sm:col-span-1">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {/* D.3: Only show subjects not already selected in another row (prevent duplicates). */}
                {availableSubjects
                  .filter((s) => s === row.subject || !selectedSubjects.has(s))
                  .map((s) => (
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

        {/* Only show "Add subject" button when stream is selected and has subjects */}
        {value.stream && availableSubjects.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={addSubjectRow}
            disabled={value.subjectGrades.length >= availableSubjects.length}
          >
            <Plus className="h-4 w-4 mr-1" /> {t.checker.addSubject}
          </Button>
        )}

        {!value.stream && (
          <p className="text-xs text-muted-foreground">Select an A/L stream to add subject grades.</p>
        )}
      </div>
    </div>
  );
}
