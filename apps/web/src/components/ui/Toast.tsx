import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useUIStore } from "@/stores/uiStore.ts";

export function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 md:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-button glass-card shadow-float border-l-4 border-l-purple-warm"
            style={{
              borderLeftColor:
                toast.type === "success"
                  ? "var(--color-green-accent)"
                  : toast.type === "error"
                    ? "var(--color-red-accent)"
                    : "var(--color-purple-warm)",
            }}
          >
            <div className="flex items-center gap-2.5 text-sm font-medium text-white-off">
              {toast.type === "success" && <CheckCircle className="w-4 h-4 text-green-accent shrink-0" />}
              {toast.type === "error" && <AlertCircle className="w-4 h-4 text-red-accent shrink-0" />}
              {toast.type === "info" && <Info className="w-4 h-4 text-purple-warm shrink-0" />}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white-muted hover:text-white shrink-0 p-0.5 rounded-full hover:bg-white/5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
export default ToastContainer;
