import { create } from "zustand";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface UIState {
  toasts: ToastMessage[];
  addToast: (message: string, type?: ToastMessage["type"]) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  toasts: [],
  addToast: (message, type = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }));
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
