import { uk, type TranslationKey } from './translations/uk';
import { en } from './translations/en';
import { settings } from '$lib/services/settings.svelte';

type Translations = Record<TranslationKey, string>;

const translations: Record<string, Translations> = {
	uk,
	en
};

export const setLocale = (locale: string) => {
	if (translations[locale]) {
		settings.setLocale(locale as any);
	}
};

export const getLocale = () => {
	return settings.locale;
};

export const t = (key: TranslationKey): string => {
	return translations[settings.locale]?.[key] ?? key;
};

/** For dynamic keys from data (e.g. animal names, facts) */
export const td = (key: string): string => {
	const dict = translations[settings.locale] as Record<string, string> | undefined;
	return dict?.[key] ?? key;
};

export const getPluralForm = (count: number): 'one' | 'few' | 'many' => {
	if (settings.locale === 'uk') {
		const mod10 = count % 10;
		const mod100 = count % 100;
		if (mod10 === 1 && mod100 !== 11) return 'one';
		if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'few';
		return 'many';
	}
	return count === 1 ? 'one' : 'many';
};

export const tp = (count: number, keyOne: TranslationKey, keyFew?: TranslationKey, keyMany?: TranslationKey): string => {
	const form = getPluralForm(count);
	if (form === 'one') return t(keyOne);
	if (form === 'few') return t(keyFew ?? keyMany ?? keyOne);
	return t(keyMany ?? keyFew ?? keyOne);
};

export const formatFont = (text: string): string => {
	if (settings.font !== 'inglobal') return text;
	// Шрифт inglobal не містить українських літер 'і', 'ї', 'є', 'ґ'.
	// Тому ми замінюємо 'і' на латинську 'i', а для інших букв використовуємо fallback-шрифти.

	const format = (letter: string, isNoto: boolean, spaceBefore?: string, spaceAfter?: string) => {
		// Використовуємо display: inline та position: relative замість inline-block/transform.
		// Це КРИТИЧНО для того, щоб браузер не розривав слова при переносі рядків.
		// Також ми обгортаємо весь результат у зовнішній span (див. нижче), щоб уникнути
		// перетворення частин тексту на окремі flex-item у батьківських контейнерах.
		const styles = ['display: inline', 'position: relative'];
		if (isNoto) {
			styles.push('font-size: 0.95em');
		} else {
			styles.push('font-size: 0.9em', 'top: 0.06em');
		}
		
		if (spaceBefore) styles.push('margin-left: 0.15em');
		if (spaceAfter) styles.push('margin-right: 0.15em');
		
		const styleAttr = ` style="${styles.join('; ')};"`;
		const span = `<span class="${isNoto ? 'font-noto' : 'font-comfortaa'}"${styleAttr}>${letter}</span>`;
		return (spaceBefore ?? '') + span + (spaceAfter ?? '');
	};

	const res = text
		.replace(/і/g, 'i')
		.replace(/І/g, 'I')
		.replace(/(\s)?(є|Є)(\s)?/g, (match, b, l, a) => format(l, true, b, a))
		.replace(/(\s)?(ї|Ї|ґ|Ґ)(\s)?/g, (match, b, l, a) => format(l, false, b, a));

	// Обгортаємо весь результат у span з display: inline. 
	// Якщо батьківський елемент - flex-контейнер, він побачить лише один flex-item,
	// і текст всередині нього буде переноситися по словах згідно з правилами мови.
	return `<span style="display: inline;">${res}</span>`;
};

export const formatPlain = (text: string): string => {
	if (settings.font !== 'inglobal') return text;
	return text
		.replace(/і/g, 'i')
		.replace(/І/g, 'I');
};
