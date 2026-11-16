import { ensureLocaleLoaded } from '$lib/i18n';
import { languageFromParam } from '$lib/i18n/routing';
import type { LayoutLoad } from './$types';

export const prerender = true;
export const trailingSlash = 'always';

export const load: LayoutLoad = async ({ params }) => {
	const lang = languageFromParam(params.lang);
	await ensureLocaleLoaded(lang);
	return { lang };
};
