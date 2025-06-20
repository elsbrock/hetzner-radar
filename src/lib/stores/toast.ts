import { writable } from 'svelte/store';

type ToastType = 'success' | 'error';
interface Toast {
	id: number;
	color: 'green' | 'red';
	message: string;
	icon: ToastType;
}

const toastQueue = writable<Toast[]>([]);

function addToast(toast: {
	message: string;
	type: ToastType;
	dismissible?: boolean;
	timeout?: number;
}) {
	const color = toast.type === 'success' ? 'green' : 'red';
	const icon = toast.type;
	toastQueue.update((queue) => [...queue, { id: Date.now(), color, icon, message: toast.message }]);
}

function removeToast(id: number) {
	toastQueue.update((queue) => queue.filter((toast) => toast.id !== id));
}

export { toastQueue, addToast, removeToast };
