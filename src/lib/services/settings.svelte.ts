import { browser } from '$app/environment';
import { storage } from '$lib/services/storage';
import type { TranslationKey } from '$lib/i18n/translations/uk';

export type Theme = 'dark' | 'light';
export type Locale = 'uk' | 'en';
export type Font = 'inglobal' | 'e-ukraine';

class Settings {
	theme = $state<Theme>('dark');
	locale = $state<Locale>('uk');
	font = $state<Font>('inglobal');
	score = $state<number>(0);
	headerTitleKey = $state<TranslationKey | null>(null);

	constructor() {
		if (browser) {
			const savedTheme = storage.get('theme') as Theme;
			if (savedTheme) {
				this.theme = savedTheme;
				document.documentElement.setAttribute('data-theme', savedTheme);
				const meta = document.querySelector('meta[name="color-scheme"]');
				if (meta) meta.setAttribute('content', savedTheme === 'dark' ? 'dark' : 'light dark');
			} else {
				const mql = window.matchMedia('(prefers-color-scheme: dark)');
				this.theme = mql.matches ? 'dark' : 'light';
				document.documentElement.setAttribute('data-theme', this.theme);
				const meta = document.querySelector('meta[name="color-scheme"]');
				if (meta) meta.setAttribute('content', this.theme === 'dark' ? 'dark' : 'light dark');
			}

			window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
				if (!storage.get('theme')) {
					this.theme = e.matches ? 'dark' : 'light';
				}
			});

			const savedLocale = storage.get('locale') as Locale;
			if (savedLocale) {
				this.locale = savedLocale;
			}

			const savedFont = storage.get('font') as Font;
			if (savedFont) {
				this.font = savedFont;
				document.documentElement.setAttribute('data-font', savedFont);
			} else {
				document.documentElement.setAttribute('data-font', this.font);
			}

			const savedScore = storage.get('score');
			if (savedScore) {
				this.score = parseInt(savedScore, 10);
			}
		}

		$effect.root(() => {
			$effect(() => {
				if (browser) {
					storage.set('theme', this.theme);
					document.documentElement.setAttribute('data-theme', this.theme);
					const meta = document.querySelector('meta[name="color-scheme"]');
					if (meta) meta.setAttribute('content', this.theme === 'dark' ? 'dark' : 'light dark');
				}
			});

			$effect(() => {
				if (browser) {
					storage.set('locale', this.locale);
				}
			});

			$effect(() => {
				if (browser) {
					storage.set('font', this.font);
					document.documentElement.setAttribute('data-font', this.font);
				}
			});

			$effect(() => {
				if (browser) {
					storage.set('score', this.score.toString());
				}
			});
		});
	}

	addScore(points: number) {
		this.score += points;
	}

	toggleTheme() {
		this.theme = this.theme === 'dark' ? 'light' : 'dark';
	}

	setLocale(locale: Locale) {
		this.locale = locale;
	}

	setFont(font: Font) {
		this.font = font;
	}

	setHeaderTitle(key: TranslationKey | null) {
		this.headerTitleKey = key;
	}
}

export const settings = new Settings();
