import * as Sentry from '@sentry/sveltekit';
import { handleErrorWithSentry } from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';

Sentry.init({
	dsn: env.PUBLIC_SENTRY_DSN || '',
	tracesSampleRate: 0.1,
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 1.0,
	environment: import.meta.env.MODE,
	integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })]
});

export const handleError = handleErrorWithSentry();