export function debounce(fn: any, delay: number) {
	let timeoutID: number;
	return function (...args: any) {
		clearTimeout(timeoutID);
		timeoutID = setTimeout(() => fn(...args), timeoutID ? delay : 0) as any;
	};
}

export function formatRelativeTime(timestamp: string | null | undefined): string {
	if (!timestamp) return 'Unknown';

	try {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSeconds = Math.floor(diffMs / 1000);
		const diffMinutes = Math.floor(diffSeconds / 60);
		const diffHours = Math.floor(diffMinutes / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffSeconds < 60) {
			return 'Just now';
		} else if (diffMinutes < 60) {
			return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
		} else if (diffHours < 24) {
			return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
		} else if (diffDays < 7) {
			return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
		} else {
			return date.toLocaleDateString();
		}
	} catch (e) {
		console.error('Error formatting relative time:', e);
		return 'Invalid Date';
	}
}

export function getAvailabilityRecency(
	lastSeen: string | null | undefined
): 'recent' | 'old' | 'very-old' | 'never' {
	if (!lastSeen) return 'never';

	try {
		const date = new Date(lastSeen);
		const now = new Date();
		const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

		if (diffHours < 24) return 'recent';
		if (diffHours < 168) return 'old'; // 7 days
		return 'very-old';
	} catch (e) {
		return 'never';
	}
}
