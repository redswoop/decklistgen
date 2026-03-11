import { ref, readonly } from "vue";

export interface Toast {
  id: number;
  message: string;
  type: "error" | "warning" | "info";
}

let nextId = 1;
const toasts = ref<Toast[]>([]);
const DURATION_MS = 5000;

function addToast(message: string, type: Toast["type"] = "error") {
  const id = nextId++;
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, DURATION_MS);
}

function dismissToast(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

export function useToast() {
  return {
    toasts: readonly(toasts),
    error: (msg: string) => addToast(msg, "error"),
    warning: (msg: string) => addToast(msg, "warning"),
    info: (msg: string) => addToast(msg, "info"),
    dismiss: dismissToast,
  };
}
