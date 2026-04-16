import { browser } from '$app/environment';

export type Theme = 'dark' | 'light';
export type Locale = 'uk' | 'en';

class Settings {
	theme = $state<Theme>('dark');
	locale = $state<Locale>('uk');

	constructor() {
		if (browser) {
			const savedTheme = localStorage.getItem('vetcrewgames_theme') as Theme;
			if (savedTheme) {
				this.theme = savedTheme;
				document.documentElement.setAttribute('data-theme', savedTheme);
			}

			const savedLocale = localStorage.getItem('vetcrewgames_locale') as Locale;
			if (savedLocale) {
				this.locale = savedLocale;
			}
		}

		$effect.root(() => {
			$effect(() => {
				if (browser) {
					localStorage.setItem('vetcrewgames_theme', this.theme);
					document.documentElement.setAttribute('data-theme', this.theme);
				}
			});

			$effect(() => {
				if (browser) {
					localStorage.setItem('vetcrewgames_locale', this.locale);
				}
			});
		});
	}

	toggleTheme() {
		this.theme = this.theme === 'dark' ? 'light' : 'dark';
	}

	setLocale(locale: Locale) {
		this.locale = locale;
	}
}

export const settings = new Settings();
