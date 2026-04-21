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
		// Візуальний баг: через специфічний кернінг та від'ємні відступи (sidebearings) 
		// у шрифтів Comfortaa/Noto, літери можуть "наїжджати" на сусідні пробіли базового шрифту.
		// Також Comfortaa/Noto візуально більші за inglobal та мають іншу базову лінію.
		// Оскільки батьківські елементи (напр. кнопки) часто є flex-контейнерами, 
		// vertical-align не працює. Використовуємо transform для точного вирівнювання.
		.replace(/(\s)?(є|Є)(\s)?/g, (match, spaceBefore, letter, spaceAfter) => {
			const styles = ['display: inline-block', 'font-size: 0.9em'];
			if (spaceBefore) styles.push('margin-left: 0.15em');
			if (spaceAfter) styles.push('margin-right: 0.15em');
			const styleAttr = ` style="${styles.join('; ')};"`;
			return `${spaceBefore ?? ''}<span class="font-noto"${styleAttr}>${letter}</span>${spaceAfter ?? ''}`;
		})
		.replace(/(\s)?(ї|Ї|ґ|Ґ)(\s)?/g, (match, spaceBefore, letter, spaceAfter) => {
			const styles = ['display: inline-block', 'font-size: 0.9em', 'transform: translateY(0.07em)'];
			if (spaceBefore) styles.push('margin-left: 0.15em');
			if (spaceAfter) styles.push('margin-right: 0.15em');
			const styleAttr = ` style="${styles.join('; ')};"`;
			return `${spaceBefore ?? ''}<span class="font-comfortaa"${styleAttr}>${letter}</span>${spaceAfter ?? ''}`;
		});
};

export const formatPlain = (text: string): string => {
	if (settings.font !== 'inglobal') return text;
	return text
		.replace(/і/g, 'i')
		.replace(/І/g, 'I');
};
