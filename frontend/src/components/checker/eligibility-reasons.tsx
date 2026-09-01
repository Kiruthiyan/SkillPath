import { CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EligibilityResult, EligibilityStepName } from "@/api";

const STEP_LABELS: Record<EligibilityStepName, string> = {
  stream: "Stream",
  subjects: "Subjects",
  rules: "Grades / Special Rules",
  zscore: "Z-Score",
};

export function EligibilityReasons({ result }: { result: EligibilityResult }) {
  return (
    <div className="space-y-2">
      <p className={cn("text-sm font-medium", result.eligible ? "text-green-700" : "text-red-700")}>
        {result.eligible ? "You appear eligible for this course." : "Not eligible — see the step that failed below."}
      </p>
      <ol className="space-y-1.5">
        {result.steps.map((step) => (
          <li key={step.step} className="flex items-start gap-2 text-sm">
            {step.status === "pass" && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />}
            {step.status === "fail" && <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />}
            {step.status === "not_applicable" && <MinusCircle className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />}
            <span>
              <span className="font-medium">{STEP_LABELS[step.step]}: </span>
              <span className="text-muted-foreground">{step.reason}</span>
            </span>
          </li>
        ))}
      </ol>
      {result.estimate?.hasSufficientData && (
        <p className="text-xs text-muted-foreground pt-1">
          Recent historical range: {result.estimate.rangeLow}–{result.estimate.rangeHigh} (weighted estimate{" "}
          {result.estimate.weightedEstimate})
        </p>
      )}
    </div>
  );
}
