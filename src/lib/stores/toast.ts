import { writable } from "svelte/store";

type ToastType = "success" | "error";
interface Toast {
  id: number;
  color: "green" | "red";
  message: string;
  icon: ToastType;
}

type ToastInput = {
  message: string;
  type?: ToastType;
  color?: "green" | "red";
  icon?: ToastType;
  dismissible?: boolean;
  timeout?: number;
};

const toastQueue = writable<Toast[]>([]);

function resolveToastType(input: ToastInput): ToastType {
  if (input.type) return input.type;
  if (input.icon) return input.icon;
  if (input.color) return input.color === "green" ? "success" : "error";
  return "success";
}

function addToast(toast: ToastInput) {
  const type = resolveToastType(toast);
  const color = toast.color ?? (type === "success" ? "green" : "red");
  const icon = toast.icon ?? type;

  toastQueue.update((queue) => [
    ...queue,
    { id: Date.now(), color, icon, message: toast.message },
  ]);
}

function removeToast(id: number) {
  toastQueue.update((queue) => queue.filter((toast) => toast.id !== id));
}

export { toastQueue, addToast, removeToast };
