import { browser } from '$app/environment';
import { on } from 'svelte/events';
import { storage } from '$lib/services/storage';
import type { TranslationKey } from '$lib/i18n/translations/uk';

export type Theme = 'dark' | 'light-green' | 'winter' | 'orange-purple';
export type Locale = 'uk' | 'en';
export type Font = 'inglobal' | 'e-ukraine';

const THEMES: readonly Theme[] = ['dark', 'light-green', 'winter', 'orange-purple'];
const LOCALES: readonly Locale[] = ['uk', 'en'];
const FONTS: readonly Font[] = ['inglobal', 'e-ukraine'];

const DARK_SCHEME_THEMES: readonly Theme[] = ['dark', 'orange-purple'];

const isTheme = (value: string | null): value is Theme => THEMES.includes(value as Theme);
const isLocale = (value: string | null): value is Locale => LOCALES.includes(value as Locale);
const isFont = (value: string | null): value is Font => FONTS.includes(value as Font);

/**
 * Налаштування застосунку: тема, мова, шрифт, наскрізний рахунок.
 *
 * **Чому тут немає жодного `$effect`.** Це module-level singleton
 * (`export const settings = new Settings()`), і для такої форми контролера
 * `$effect` у конструкторі кидає `effect_orphan` — саме тому раніше тут стояв
 * `$effect.root`. Він давав чотири ефекти, які ніхто ніколи не прибирає, і
 * заразом два дефекти, яких із самого коду не видно (SVELTE-CORE-v8 § 1.9):
 *
 *  * ефект спрацьовує на БУДЬ-ЯКУ зміну стану — зокрема на ту, що прийшла із
 *    самого сховища під час гідрації. Тобто застосунок перезаписував у
 *    `localStorage` рівно те, що звідти щойно прочитав;
 *  * логіка «застосувати тему до DOM» існувала в трьох копіях: двічі в
 *    конструкторі й раз в ефекті. Розходяться такі копії мовчки.
 *
 * Канон для module-level singleton — **наскрізний запис у мутаторі**: стан,
 * DOM і сховище оновлюються там, де відбувається сама подія. Гідрація —
 * у конструкторі, підписка на зовнішнє джерело — в `init()`, чий cleanup
 * повертає компонент-споживач (§ 2.6).
 */
class Settings {
	theme = $state<Theme>('dark');
	locale = $state<Locale>('uk');
	font = $state<Font>('inglobal');
	score = $state<number>(0);
	headerTitleKey = $state<TranslationKey | null>(null);

	/** `true`, доки користувач не обрав тему сам: тоді її диктує система. */
	#themeFollowsSystem = true;

	constructor() {
		if (!browser) return;

		// SYNC: та сама міграція 'light' → 'light-green' і той самий вибір за
		// `prefers-color-scheme` продубльовані в інлайн-скрипті `src/app.html`.
		// Інакше ніяк: скрипт першого кадру не може імпортувати цей модуль. Обидва
		// місця правляться разом (UI-UX-v8 § 1.1).
		const savedTheme = storage.get('theme');
		if (savedTheme === 'light' || isTheme(savedTheme)) {
			this.theme = savedTheme === 'light' ? 'light-green' : savedTheme;
			this.#themeFollowsSystem = false;
		} else {
			this.theme = this.#systemTheme();
		}
		this.#applyTheme();

		// Мову тут НЕ читаємо зі сховища: її диктує адреса, і виставляє її
		// кореневий layout через `applyRouteLocale()` ще до рендеру дітей.
		// Збережений вибір застосовується лише на голому шляху — і не тут, а
		// навігацією, бо змінити треба адресу, а не тільки текст (I18N-v8 § 3.3).
		this.#applyLocale();

		const savedFont = storage.get('font');
		if (isFont(savedFont)) this.font = savedFont;
		this.#applyFont();

		// `Number.isFinite`, а не гола перевірка на істинність: зіпсоване значення
		// давало б `NaN`, і рахунок ставав `NaN` до кінця сесії, ніде не впавши.
		const savedScore = Number.parseInt(storage.get('score') ?? '', 10);
		if (Number.isFinite(savedScore)) this.score = savedScore;
	}

	/**
	 * Підписка на системну тему. Викликає `+layout.svelte` один раз і повертає
	 * cleanup із свого `onMount` — `$effect` тут недоступний за визначенням
	 * (див. докблок класу).
	 */
	init(): () => void {
		if (!browser) return () => {};

		// `on` зі `svelte/events` замість `addEventListener`: він повертає функцію
		// зняття, тож у cleanup нічого не треба повторювати руками. Доти підписка
		// не знімалася взагалі.
		return on(window.matchMedia('(prefers-color-scheme: dark)'), 'change', () => {
			if (!this.#themeFollowsSystem) return;
			this.theme = this.#systemTheme();
			this.#applyTheme();
		});
	}

	#systemTheme(): Theme {
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light-green';
	}

	/**
	 * Мета-тег рухомий навмисно: статичне значення повертає Force Dark Mode на
	 * Android Chrome, який самовільно інвертує кольори світлих тем
	 * (UI-UX-v8 § 1.2).
	 */
	#applyTheme(): void {
		document.documentElement.setAttribute('data-theme', this.theme);
		const meta = document.querySelector('meta[name="color-scheme"]');
		meta?.setAttribute('content', DARK_SCHEME_THEMES.includes(this.theme) ? 'dark' : 'light dark');
	}

	#applyLocale(): void {
		document.documentElement.setAttribute('lang', this.locale);
	}

	#applyFont(): void {
		document.documentElement.setAttribute('data-font', this.font);
	}

	addScore(points: number): void {
		this.score += points;
		storage.set('score', this.score.toString());
	}

	setTheme(theme: Theme): void {
		this.theme = theme;
		this.#themeFollowsSystem = false;
		this.#applyTheme();
		storage.set('theme', theme);
	}

	toggleTheme(): void {
		const next = (THEMES.indexOf(this.theme) + 1) % THEMES.length;
		this.setTheme(THEMES[next]);
	}

	/**
	 * Мова, яку диктує АДРЕСА. У сховище не пишеться: сегмент шляху — це запит
	 * на конкретну сторінку, а не вибір користувача (I18N-v8 § 3.3, порядок
	 * «адреса → збережений вибір → типова»).
	 *
	 * Викликається з кореневого layout ДО рендеру дітей: під час prerender
	 * сторінки генеруються послідовно в одному процесі, і модульний синглтон
	 * переносить значення з попередньої сторінки на наступну. Ознака помилки —
	 * `/en/` українською (SVELTE-CORE-v8 § 5.1).
	 */
	applyRouteLocale(locale: Locale): void {
		if (this.locale !== locale) this.locale = locale;
		if (browser) this.#applyLocale();
	}

	/**
	 * Вибір користувача. Мову міняє навігація на мовну адресу, а це — тільки
	 * запам'ятовування, щоб наступний захід на голий шлях відкрився нею ж.
	 */
	rememberLocale(locale: Locale): void {
		storage.set('locale', locale);
	}

	/** Збережений вибір або `null`, якщо його не робили. */
	savedLocale(): Locale | null {
		const saved = storage.get('locale');
		return isLocale(saved) ? saved : null;
	}

	setFont(font: Font): void {
		this.font = font;
		this.#applyFont();
		storage.set('font', font);
	}

	setHeaderTitle(key: TranslationKey | null): void {
		this.headerTitleKey = key;
	}
}

export const settings = new Settings();
