import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Toast as ToastType } from "@/hooks/use-toast";

export function Toast({ toast, onDismiss }: { toast: ToastType; onDismiss: (id: string) => void }) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg",
        toast.variant === "destructive"
          ? "border-destructive-border bg-destructive text-destructive-foreground"
          : "border-[hsl(var(--border))] bg-card text-card-foreground",
      )}
    >
      <div className="flex-1 space-y-1">
        {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
        {toast.description && <p className="text-sm opacity-90">{toast.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded-md p-1 opacity-70 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
