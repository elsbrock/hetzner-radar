import { writable } from "svelte/store";

type ToastType = "success" | "error";
interface Toast {
    id: number;
    color: "green" | "red";
    message: string;
    icon: ToastType;
}

const toastQueue = writable<Toast[]>([]);

function addToast(toast: Omit<Toast, "id">) {
    toastQueue.update((queue) => [...queue, { id: Date.now(), ...toast }]);
}

function removeToast(id: number) {
    toastQueue.update((queue) => queue.filter((toast) => toast.id !== id));
}

export { toastQueue, addToast, removeToast };
