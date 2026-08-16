import { browser } from '$app/environment';
import { MediaQuery } from 'svelte/reactivity';
import { settings } from '$lib/services/settings.svelte';

/**
 * Хто малює смугу прокрутки і де вона (SCROLLBAR-v8 § 2.1).
 *
 * Обраний режим і режим, який СПРАВДІ діє, — різні речі: на сенсорному екрані
 * власна смуга не потрібна нікому, бо прокручують пальцем. Рішення живе тут,
 * компонент лише питає, чи його черга.
 *
 * **Головне відхилення від канону.** Там смуга малює прокрутку СТОРІНКИ —
 * `window.scrollY`, `window.scrollTo`, `documentElement.scrollHeight`. Тут
 * сторінка не прокручується взагалі: `html` і `body` заввишки рівно з вікно, а
 * прокручується `.page-transition-wrapper` усередині. Канонний код, узятий
 * буквально, дав би смугу, яка ніколи не рухається, — і виглядав би при цьому
 * бездоганно. Тому прокрутник тут не мається на увазі, а публікується явно.
 */

/** Сенсорні пристрої лишаються з нативною: там прокрутка пальцем. */
const canHover = new MediaQuery('(hover: hover) and (pointer: fine)');

class ScrollbarState {
	/**
	 * Елемент, який справді прокручується. Реєструє `+layout.svelte`.
	 *
	 * `null` означає «прокрутника ще немає» — між переходами таке буває, і це
	 * не помилка.
	 */
	scroller = $state<HTMLElement | null>(null);

	/** Меню вибору режиму: де показати і чи показувати взагалі. */
	menu = $state<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });

	/**
	 * Обраний режим може виявитися недоступним — тоді лишається нативна смуга.
	 * Це не помилка, а свідомий відступ: краще звичайна робоча смуга, ніж жодної.
	 */
	readonly active = $derived.by<'native' | 'custom'>(() => {
		if (!browser || !canHover.current) return 'native';
		return settings.scrollbarMode === 'custom' ? 'custom' : 'native';
	});

	/** Чи ховати нативну смугу. Єдине джерело правди для класу на `<html>`. */
	readonly hidesNative = $derived(this.active !== 'native');

	openMenu = (x: number, y: number) => {
		this.menu = { open: true, x, y };
	};

	closeMenu = () => {
		this.menu = { ...this.menu, open: false };
	};

	/**
	 * Зареєструвати прокрутник. Повертає прибирання для `use:`.
	 *
	 * Знімати посилання можна ЛИШЕ якщо воно ще наше: під час переходу існують
	 * дві обгортки одночасно, і вихідна вмирає ПІСЛЯ того, як з'явилася нова.
	 * Без цієї перевірки смуга зникала б на кожній навігації.
	 */
	register = (node: HTMLElement) => {
		this.scroller = node;
		return {
			destroy: () => {
				if (this.scroller === node) this.scroller = null;
			}
		};
	};
}

export const scrollbar = new ScrollbarState();
