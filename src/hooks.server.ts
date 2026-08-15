import * as Sentry from '@sentry/sveltekit';
import { handleErrorWithSentry } from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';

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

export const handleError = handleErrorWithSentry();
