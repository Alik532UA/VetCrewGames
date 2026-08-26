/**
 * The neighbouring sites, and how each one is told which language to open in.
 *
 * ## Why this file exists
 *
 * Eight sites by one author, six of them on the same origin, all linking to each
 * other — and until now every one of those links was a bare URL. A visitor reading
 * this site in German clicked through to VetCrewGames and got Ukrainian, because a
 * bare path means "the language served at the bare path", and there VetCrewGames
 * serves Ukrainian. That is not a bug in the receiver: nothing in the link ever said
 * what language the visitor was reading.
 *
 * ## Why the table lives in the sending site
 *
 * Building `/VetCrewGames/de/` requires knowing that VetCrewGames has German and
 * that Ukrainian is the one language it does NOT put in the path. That knowledge
 * belongs to VetCrewGames, and copying it here is a real cost: add a language there
 * and this table is stale; remove one and this site starts emitting 404s.
 *
 * The cost is paid deliberately, and the receipt is `siblings.test.ts`: every repo
 * carries this same file and a test asserting that ITS OWN row still matches its
 * real `LOCALES` and `DEFAULT_LOCALE`. Drift is therefore caught in the repo that
 * causes it, on the commit that causes it, rather than showing up as a dead link on
 * somebody else's site months later.
 *
 * ## Keep this file identical everywhere
 *
 * It imports nothing on purpose — not `$lib/i18n/locales`, not `$app/paths`. A copy
 * that reaches for local types stops being a copy, and then syncing eight of them
 * means reading eight diffs instead of one. Repo-specific checking is the test's
 * job, not this module's.
 */

export type SiblingId =
	| 'adoptananimal'
	| 'vetcrewgames'
	| 'digitalworkshop'
	| 'cv'
	| 'mindstep'
	| 'slovko'
	| 'as5'
	| 'teatralo4ka';

export interface Sibling {
	/** Scheme and host, no trailing slash. */
	origin: string;
	/** Path prefix the site is served under, no trailing slash. Empty on its own domain. */
	base: string;
	/** Every language the site actually serves a full translation for. */
	locales: readonly string[];
	/**
	 * The language served at the BARE path. It never appears as a segment, so a link
	 * that wants it cannot say so in the path — see `siblingUrl` below.
	 */
	defaultLocale: string;
	/**
	 * `path` — the language is a URL segment, so a link names it without any
	 * JavaScript and the very first frame is already in the right language.
	 *
	 * `query` — the site has no language segment at all (MindStep, Slovko, as5 read
	 * their language from storage and the browser). There `?lang=` is the only handle
	 * that exists. It costs a frame of the default language before hydration, which is
	 * why it is the exception and not the rule (I18N-v8 § 3.1).
	 */
	transport: 'path' | 'query';
	/** Whether the site's URLs end in a slash. Only meaningful for `transport: 'path'`. */
	trailingSlash: boolean;
}

export const SIBLINGS = {
	adoptananimal: {
		origin: 'https://alik532ua.github.io',
		base: '/adoptananimal',
		locales: ['en', 'uk', 'de', 'nl'],
		defaultLocale: 'en',
		transport: 'path',
		trailingSlash: false
	},
	vetcrewgames: {
		origin: 'https://alik532ua.github.io',
		base: '/VetCrewGames',
		locales: ['uk', 'en', 'de', 'nl'],
		defaultLocale: 'uk',
		transport: 'path',
		trailingSlash: true
	},
	digitalworkshop: {
		origin: 'https://alik532ua.github.io',
		base: '/DigitalWorkshop',
		locales: [
			'en',
			'en-us',
			'uk',
			'ja',
			'es',
			'fr',
			'pt',
			'it',
			'de',
			'nl',
			'be',
			'pl',
			'cs',
			'sk',
			'bg',
			'hr',
			'sl',
			'mk',
			'ro',
			'sv',
			'no',
			'da',
			'is',
			'ca',
			'fi',
			'el',
			'ga',
			'cy',
			'et',
			'lv',
			'lt',
			'crh',
			'ka',
			'sq',
			'ko',
			'tr',
			'he',
			'mt',
			'chk',
			'pon',
			'kos',
			'yap'
		],
		defaultLocale: 'uk',
		transport: 'path',
		trailingSlash: true
	},
	cv: {
		origin: 'https://alik532ua.github.io',
		base: '/CV',
		locales: [
			'en',
			'en-us',
			'uk',
			'ja',
			'es',
			'fr',
			'pt',
			'it',
			'de',
			'nl',
			'be',
			'pl',
			'cs',
			'sk',
			'bg',
			'hr',
			'sl',
			'mk',
			'ro',
			'sv',
			'no',
			'da',
			'is',
			'ca',
			'fi',
			'el',
			'ga',
			'cy',
			'et',
			'lv',
			'lt',
			'crh',
			'ka',
			'sq',
			'ko',
			'tr',
			'he',
			'mt',
			'chk',
			'pon',
			'kos',
			'yap'
		],
		defaultLocale: 'en',
		transport: 'path',
		trailingSlash: true
	},
	teatralo4ka: {
		origin: 'https://teatralo4ka.odesa.ua',
		base: '',
		locales: ['uk', 'en'],
		defaultLocale: 'uk',
		transport: 'path',
		trailingSlash: true
	},
	mindstep: {
		origin: 'https://alik532ua.github.io',
		base: '/MindStep',
		locales: ['uk', 'en', 'crh', 'nl'],
		defaultLocale: 'uk',
		transport: 'query',
		trailingSlash: true
	},
	slovko: {
		origin: 'https://alik532ua.github.io',
		base: '/Slovko',
		locales: ['uk', 'en', 'crh', 'nl', 'de', 'el', 'pl'],
		defaultLocale: 'uk',
		transport: 'query',
		trailingSlash: true
	},
	as5: {
		origin: 'https://as5.odesa.ua',
		base: '',
		locales: ['uk', 'en'],
		defaultLocale: 'uk',
		transport: 'query',
		trailingSlash: false
	}
} as const satisfies Record<SiblingId, Sibling>;

/** Primary subtag, lowercased: `en-US` and `EN_us` both come back as `en`. */
const primary = (tag: string): string => tag.toLowerCase().replace(/_/g, '-').split('-')[0];

/**
 * The language the target will actually be asked for.
 *
 * Four rungs, and the third is the one worth arguing about. A Dutch reader clicking
 * through to a site that serves only Ukrainian and English is far better served by
 * English than by the site's own default — the fallback is meant to be readable, not
 * merely valid. Where the target has no English either, its default is all that is
 * left.
 */
export function resolveSiblingLocale(id: SiblingId, locale: string): string {
	const { defaultLocale } = SIBLINGS[id];
	// Widened on purpose: `as const` makes each row's `locales` a tuple of literals, so
	// asking it about an arbitrary tag is a type error rather than the question it is.
	const locales: readonly string[] = SIBLINGS[id].locales;

	if (locales.includes(locale)) return locale;

	const base = primary(locale);
	const byPrimary = locales.find((candidate) => primary(candidate) === base);
	if (byPrimary) return byPrimary;

	if (locales.includes('en')) return 'en';
	return defaultLocale;
}

/**
 * Absolute URL of a neighbouring site's home page, in the language given.
 *
 * The language is written ONCE, in whichever half of the URL can carry it:
 *
 * - a language the target puts in the path → the path says it (`/VetCrewGames/de/`);
 * - the target's own default, or a site with no language segment at all → `?lang=`.
 *
 * The second case is not redundancy. The bare path means "no choice made" by canon
 * (I18N-v8 § 3.3), so a visitor who once set that site to English would get English
 * even though they arrived from a Ukrainian page — the reason `?lang=` had to remain
 * readable on the bare path of every site here. Linking to `/VetCrewGames/uk/`
 * instead is not an option: prefixing the default language is exactly what these
 * sites deliberately do not do, and that address is a 404.
 *
 * `params` rides along untouched, for links that already carry state of their own —
 * the school sites open the workshop on a specific tab and theme.
 */
export function siblingUrl(
	id: SiblingId,
	locale: string,
	params: Record<string, string> = {}
): string {
	const site = SIBLINGS[id];
	const resolved = resolveSiblingLocale(id, locale);
	const inPath = site.transport === 'path' && resolved !== site.defaultLocale;

	const path = inPath ? `/${resolved}${site.trailingSlash ? '/' : ''}` : '/';

	const query = new URLSearchParams(params);
	if (!inPath) query.set('lang', resolved);

	// Built rather than interpolated: `?${query}` leaves a bare `?` on every
	// path-form link, and a trailing `?` is a different string to every href
	// assertion and every analytics grouping that ever reads these.
	const search = query.toString();
	return `${site.origin}${site.base}${path}${search ? `?${search}` : ''}`;
}
