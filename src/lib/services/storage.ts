import { browser } from '$app/environment';

const PREFIX = 'vetcrewgames_';

export const storage = {
	get(key: string): string | null {
		if (!browser) return null;
		return localStorage.getItem(PREFIX + key);
	},
	set(key: string, value: string): void {
		if (!browser) return;
		localStorage.setItem(PREFIX + key, value);
	},
	remove(key: string): void {
		if (!browser) return;
		localStorage.removeItem(PREFIX + key);
	},
	clear(): void {
		if (!browser) return;
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(PREFIX)) keysToRemove.push(key);
		}
		keysToRemove.forEach((k) => localStorage.removeItem(k));
	},
	getJSON<T>(key: string): T | null {
		const raw = storage.get(key);
		if (raw === null) return null;
		try {
			return JSON.parse(raw) as T;
		} catch (err) {
			console.warn(`[storage] Failed to parse "${key}" from localStorage`, err);
			return null;
		}
	},
	setJSON(key: string, value: unknown): void {
		storage.set(key, JSON.stringify(value));
	}
};

export const sessionStore = {
	get(key: string): string | null {
		if (!browser) return null;
		return sessionStorage.getItem(PREFIX + key);
	},
	set(key: string, value: string): void {
		if (!browser) return;
		sessionStorage.setItem(PREFIX + key, value);
	},
	remove(key: string): void {
		if (!browser) return;
		sessionStorage.removeItem(PREFIX + key);
	},
	clear(): void {
		if (!browser) return;
		const keysToRemove: string[] = [];
		for (let i = 0; i < sessionStorage.length; i++) {
			const key = sessionStorage.key(i);
			if (key?.startsWith(PREFIX)) keysToRemove.push(key);
		}
		keysToRemove.forEach((k) => sessionStorage.removeItem(k));
	},
	getJSON<T>(key: string): T | null {
		const raw = sessionStore.get(key);
		if (raw === null) return null;
		try {
			return JSON.parse(raw) as T;
		} catch (err) {
			console.warn(`[storage] Failed to parse "${key}" from sessionStorage`, err);
			return null;
		}
	},
	setJSON(key: string, value: unknown): void {
		sessionStore.set(key, JSON.stringify(value));
	}
};
