import { create } from "zustand";

export type ToastVariant = "default" | "destructive";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  toast: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

let count = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  toast: (toast) => {
    const id = String(++count);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  const toast = useToastStore((s) => s.toast);
  const dismiss = useToastStore((s) => s.dismiss);
  return { toast, dismiss };
}
