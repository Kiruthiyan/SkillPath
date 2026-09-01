import { Toast } from "@/components/ui/toast";
import { useToastStore } from "@/hooks/use-toast";

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}
