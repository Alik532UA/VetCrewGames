import { browser } from '$app/environment';

export type Theme = 'dark' | 'light';
export type Locale = 'uk' | 'en';
export type Font = 'inglobal' | 'e-ukraine';

class Settings {
	theme = $state<Theme>('dark');
	locale = $state<Locale>('uk');
	font = $state<Font>('inglobal');

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

			const savedFont = localStorage.getItem('vetcrewgames_font') as Font;
			if (savedFont) {
				this.font = savedFont;
				document.documentElement.setAttribute('data-font', savedFont);
			} else {
				document.documentElement.setAttribute('data-font', this.font);
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

			$effect(() => {
				if (browser) {
					localStorage.setItem('vetcrewgames_font', this.font);
					document.documentElement.setAttribute('data-font', this.font);
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

	setFont(font: Font) {
		this.font = font;
	}
}

export const settings = new Settings();
