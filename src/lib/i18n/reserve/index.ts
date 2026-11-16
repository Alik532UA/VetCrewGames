import { addTranslations } from '../index';

/**
 * Словник ЗАПОВІДНИКА — довантажується.
 */

const loaded = new Set<string>();

const LOADERS: Record<string, () => Promise<{ reserve: Record<string, string> }>> = {
	uk: () => import('./uk'),
	en: () => import('./en'),
	'en-us': () => import('./en-us'),
	de: () => import('./de'),
	nl: () => import('./nl'),
	be: () => import('./be'),
	pl: () => import('./pl'),
	cs: () => import('./cs'),
	sk: () => import('./sk'),
	bg: () => import('./bg'),
	hr: () => import('./hr'),
	sl: () => import('./sl'),
	mk: () => import('./mk'),
	es: () => import('./es'),
	ca: () => import('./ca'),
	fr: () => import('./fr'),
	pt: () => import('./pt'),
	it: () => import('./it'),
	ro: () => import('./ro'),
	sv: () => import('./sv'),
	no: () => import('./no'),
	da: () => import('./da'),
	is: () => import('./is'),
	ga: () => import('./ga'),
	cy: () => import('./cy'),
	et: () => import('./et'),
	lv: () => import('./lv'),
	lt: () => import('./lt'),
	fi: () => import('./fi'),
	el: () => import('./el'),
	sq: () => import('./sq'),
	crh: () => import('./crh'),
	tr: () => import('./tr'),
	ka: () => import('./ka'),
	ja: () => import('./ja'),
	ko: () => import('./ko'),
	he: () => import('./he'),
	mt: () => import('./mt'),
	chk: () => import('./chk'),
	pon: () => import('./pon'),
	kos: () => import('./kos'),
	yap: () => import('./yap')
};

/**
 * Довантажити рядки заповідника для мови й додати їх у спільний реєстр.
 */
export async function loadReserveText(locale: string): Promise<void> {
	if (loaded.has(locale)) return;

	const loader = LOADERS[locale];
	const dict: Record<string, string> = loader ? (await loader()).reserve : {};

	loaded.add(locale);
	addTranslations(locale, dict);
}

/** Отримати словник заповідника для мови безпосередньо. */
export async function getReserveText(locale: string): Promise<Record<string, string>> {
	const loader = LOADERS[locale];
	return loader ? (await loader()).reserve : {};
}
