/**
 * Словник вікна «На весь екран» — ДОВАНТАЖУЄТЬСЯ.
 */

const loaded = new Map<string, Record<string, string>>();

const LOADERS: Record<string, () => Promise<{ install: Record<string, string> }>> = {
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

/** Словник для мови. Порожній — невідома мова, і тоді ключ видно на екрані. */
export async function loadInstallText(locale: string): Promise<Record<string, string>> {
	const cached = loaded.get(locale);
	if (cached) return cached;

	const loader = LOADERS[locale];
	const dict: Record<string, string> = loader ? (await loader()).install : {};

	loaded.set(locale, dict);
	return dict;
}
