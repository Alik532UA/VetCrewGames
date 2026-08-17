import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ANALYTICS-v8 § 5 — гарди лічильника.
 *
 * Гейт «vitest — гарди аналітики» перелічений у `canon.json`, а перевірки не
 * було. Це не формальність: усе, що стоїть між локальною роботою й бойовою
 * статистикою, — три умови в одному рядку (`browser && !dev && isConfigured`), і
 * зламати кожну з них можна мовчки.
 *
 * Ціна помилки несиметрична, і саме тому перевірка потрібна. Зайва подія з
 * dev-машини не падає ніде: `gtag` приймає її, GA4 приймає теж — просто
 * показники сайту місяцями змішані з тим, як розробник тицяв кнопки. Побачити це
 * можна лише в GA4 і лише якщо шукати.
 *
 * Окремо перевіряється `isConfigured`. CODE-QUALITY-v8 § 1.3 називає цей клас
 * прямо: без анотації `: string` TypeScript звужує обидві константи до
 * літеральних типів, порівняння стає завжди-хибним, і перевірка на плейсхолдер
 * перетворюється на мертву гілку. Анотація в `analytics.ts` стоїть саме тому, і
 * тут вона під наглядом.
 *
 * Модулі перезавантажуються на кожен випадок (`vi.resetModules`): `analytics.ts`
 * обчислює `isConfigured` і тримає `started` на рівні модуля, тож без скидання
 * другий випадок бачив би стан першого.
 */

/** Аліас `$app/environment` веде на мок із фіксованими значеннями — тут потрібні свої. */
function stubEnvironment(env: { browser: boolean; dev: boolean }) {
	vi.doMock('$app/environment', () => ({ ...env, building: false, version: 'test' }));
}

/**
 * `gtag`, який лише записує виклики.
 *
 * `initAnalytics` перевизначає `window.gtag` власною чергою, тому шпигун
 * ставиться і на `document.createElement`: скрипт `googletagmanager` у тесті
 * вантажитися не має, а факт спроби — це те, що перевіряється.
 */
function spyOnDom() {
	const appended: string[] = [];
	vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
		appended.push((node as HTMLScriptElement).src ?? '');
		return node;
	});
	return appended;
}

describe('аналітика: гарди (ANALYTICS-v8 § 5)', () => {
	beforeEach(() => {
		vi.resetModules();
		delete (window as { gtag?: unknown }).gtag;
		delete (window as { dataLayer?: unknown }).dataLayer;
	});

	afterEach(() => {
		vi.doUnmock('$app/environment');
		vi.restoreAllMocks();
	});

	it('у dev-режимі не відправляє нічого й не вантажить скрипт', async () => {
		stubEnvironment({ browser: true, dev: true });
		const appended = spyOnDom();
		const { track, trackPageView, initAnalytics } = await import('./analytics');

		initAnalytics();
		track('language_change', { language: 'uk' });
		trackPageView();

		expect(window.gtag, 'у dev `gtag` не має навіть з’являтися').toBeUndefined();
		expect(appended, 'скрипт лічильника вантажиться в dev').toEqual([]);
	});

	/**
	 * Спостерігати треба `dataLayer` і `<script>`, а НЕ підставний `window.gtag`.
	 *
	 * Перша редакція цієї перевірки ставила шпигуна в `window.gtag` і чекала, що
	 * його не покличуть. Вона була зелена завжди: `track()` спершу кличе
	 * `initAnalytics()`, а той ПЕРЕВИЗНАЧАЄ `window.gtag` власною чергою — тобто
	 * шпигуна затирали ще до відправлення, і результат не залежав від гарда
	 * взагалі. Знайдено зворотним експериментом (AI-AGENT-PITFALLS-v8 § 1.1):
	 * гард `browser` прибрано, перевірка лишилася зеленою. Це не привід
	 * послабити очікування — це значить, що вона дивилася не туди.
	 */
	it('без браузера мовчить — prerender не має слати подій', async () => {
		// Під час prerender `window` існує (jsdom його дає), а `browser` — ні.
		// Саме цей розрив і ловиться: код, що спирається на наявність `window`,
		// під prerender відпрацював би.
		stubEnvironment({ browser: false, dev: false });
		const appended = spyOnDom();
		const { track, trackPageView } = await import('./analytics');

		track('language_change', { language: 'en' });
		trackPageView();

		expect(
			(window as { dataLayer?: unknown[] }).dataLayer,
			'черга подій піднялася під час prerender'
		).toBeUndefined();
		expect(appended, 'скрипт лічильника вантажиться під час prerender').toEqual([]);
	});

	it('у production подія доходить до gtag', async () => {
		// Дзеркальна половина: без неї три попередні перевірки проходили б і на
		// лічильнику, вимкненому назавжди (AI-AGENT-PITFALLS-v8 § 1).
		stubEnvironment({ browser: true, dev: false });
		spyOnDom();
		const { track } = await import('./analytics');

		track('language_change', { language: 'en' });

		const queued = [...((window as { dataLayer?: unknown[] }).dataLayer ?? [])];
		const events = queued.filter((args) => (args as IArguments)[0] === 'event');
		expect(events.length, 'подія не потрапила в чергу dataLayer').toBeGreaterThan(0);
	});

	it('перевірка плейсхолдера жива, а не завжди-хибна (CODE-QUALITY-v8 § 1.3)', () => {
		// Читається джерело, бо йдеться саме про ТИП константи: без `: string`
		// TypeScript звужує обидві до літералів, порівняння стає завжди-хибним, і
		// жодна поведінкова перевірка цього не побачить — гілка просто мертва.
		const source = readFileSync('src/lib/services/analytics.ts', 'utf8');
		expect(
			source,
			'GA_ID без анотації `: string` — порівняння з плейсхолдером стане мертвим кодом'
		).toMatch(/const GA_ID: string =/);
		expect(source, 'зник сам плейсхолдер, з яким звіряються').toContain('G-XXXXXXXXXX');
	});
});
