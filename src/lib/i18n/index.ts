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
