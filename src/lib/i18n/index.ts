import { uk, type TranslationKey } from './translations/uk';
import { en } from './translations/en';
import { settings } from '../settings.svelte';

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
	// Тому ми вимушені замінювати 'і' на латинську 'i', а для інших букв 
	// використовувати fallback-шрифти (Noto Serif та Comfortaa) через <span>.
	return text
		.replace(/і/g, 'i')
		.replace(/І/g, 'I')
		// Візуальний баг: коли перед fallback-літерою є пробіл (напр. "Що їмо?"),
		// через специфічний кернінг та від'ємний лівий відступ у шрифтів Comfortaa/Noto, 
		// літера "наїжджає" на пробіл базового шрифту, через що він візуально "зникає".
		// Ми повертаємо пробіл на місце (поза span) і додаємо самій літері `margin-left: 0.15em`, 
		// щоб примусово відштовхнути її від пробілу. Всередині слів (без пробілу) відступ не додається.
		.replace(/(\s)?(є|Є)/g, (match, space, letter) =>
			space ? `${space}<span class="font-noto" style="margin-left: 0.15em;">${letter}</span>` : `<span class="font-noto">${letter}</span>`
		)
		.replace(/(\s)?(ї|Ї|ґ|Ґ)/g, (match, space, letter) =>
			space ? `${space}<span class="font-comfortaa" style="margin-left: 0.15em;">${letter}</span>` : `<span class="font-comfortaa">${letter}</span>`
		);
};

export const formatPlain = (text: string): string => {
	if (settings.font !== 'inglobal') return text;
	return text
		.replace(/і/g, 'i')
		.replace(/І/g, 'I');
};
