import * as Sentry from '@sentry/sveltekit';
import { handleErrorWithSentry } from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import type { Handle } from '@sveltejs/kit';
import { languageFromParam } from '$lib/i18n/routing';

/**
 * Профіль static: серверного рантайму немає, тож цей hook виконується РІВНО
 * один раз — під час prerender у `npm run build`. Він ловить помилки
 * генерації сторінок, а не помилки відвідувачів; ті ловить `hooks.client.ts`.
 *
 * Через це тут немає ні `replay`, ні `beforeSend` для офлайну: під час збірки
 * ні того, ні того не буває. `release` лишається — щоб помилка prerender
 * потрапила в ту саму збірку, що й клієнтські.
 */
Sentry.init({
	dsn: env.PUBLIC_SENTRY_DSN || '',
	release: __APP_VERSION__,
	tracesSampleRate: 0.1
});

/**
 * `<html lang>` для ЗГЕНЕРОВАНОЇ сторінки (I18N-v8 § 5.2, ACCESSIBILITY-v8 § 9).
 *
 * Атрибут був зашитий у `app.html` як `uk`, тож англійські сторінки виходили
 * зі збірки українськими для скрінрідера й для пошуковика — а на екрані все
 * при цьому було правильно, бо текст іде зі словника. Дефект видно виключно у
 * `build/*.html`.
 *
 * Клієнтський бік цього не покриває: `settings.applyRouteLocale()` виставляє
 * атрибут після гідрації, тобто вже після того, як пошуковик прочитав файл.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const lang = languageFromParam(event.params.lang);
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', lang)
	});
};

export const handleError = handleErrorWithSentry();
