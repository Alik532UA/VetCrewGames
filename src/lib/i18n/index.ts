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

export const formatFont = (text: string): string => {
	if (settings.font !== 'inglobal') return text;
	return text
		.replace(/і/g, 'i')
		.replace(/І/g, 'I')
		.replace(/є/g, '<span class="font-noto">є</span>')
		.replace(/Є/g, '<span class="font-noto">Є</span>')
		.replace(/ї/g, '<span class="font-comfortaa">ї</span>')
		.replace(/Ї/g, '<span class="font-comfortaa">Ї</span>')
		.replace(/ґ/g, '<span class="font-comfortaa">ґ</span>')
		.replace(/Ґ/g, '<span class="font-comfortaa">Ґ</span>');
};

export const formatPlain = (text: string): string => {
	if (settings.font !== 'inglobal') return text;
	return text
		.replace(/і/g, 'i')
		.replace(/І/g, 'I');
};
