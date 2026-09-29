import { afterEach, describe, expect, it, vi } from 'vitest';
import { canPromptInstall, promptInstall } from './installPrompt';
import { logService } from '$lib/services/logService.svelte';

/**
 * ВСТАНОВЛЕННЯ ОДНИМ НАТИСКОМ (прохання автора 2026-09-29, відповідь 2 — «A»).
 *
 * Подію ловить скрипт першого кадру (`app.html`, перевіряє `src/fullscreen-first-frame.test.ts`)
 * і кладе в `window.__vetcrewgamesInstallPrompt`. Тут — лише те, що з нею робить натиск.
 * Подію підробляємо: jsdom її не має, а справжній Chrome кидає її лише придатному сайту.
 *
 * Зворотний експеримент: подія не забувається після показу — червоніє «лише раз».
 */

type Choice = { outcome: 'accepted' | 'dismissed'; platform: string };
type Stash = Window & { __vetcrewgamesInstallPrompt?: unknown };

function stashPrompt(choice: Choice | Error) {
	const event = {
		prompt: vi.fn(async () => {
			if (choice instanceof Error) throw choice;
		}),
		userChoice: choice instanceof Error ? new Promise(() => {}) : Promise.resolve(choice)
	};
	(window as Stash).__vetcrewgamesInstallPrompt = event;
	return event;
}

afterEach(() => {
	Reflect.deleteProperty(window, '__vetcrewgamesInstallPrompt');
	vi.restoreAllMocks();
});

describe('вікно браузера «Встановити додаток»', () => {
	it('без події — вікна немає, і натиск просить кроки', async () => {
		expect(canPromptInstall()).toBe(false);
		expect(await promptInstall()).toBe('unavailable');
	});

	it('показує вікно браузера й віддає відповідь людини — лише раз', async () => {
		const event = stashPrompt({ outcome: 'dismissed', platform: 'web' });
		expect(canPromptInstall()).toBe(true);

		expect(await promptInstall()).toBe('dismissed');
		expect(event.prompt).toHaveBeenCalledTimes(1);
		expect(canPromptInstall()).toBe(false);
		expect(await promptInstall()).toBe('unavailable');
	});

	it('згода — «accepted»', async () => {
		stashPrompt({ outcome: 'accepted', platform: 'web' });
		expect(await promptInstall()).toBe('accepted');
	});

	it('браузер відмовив — у журнал, а натиск просить кроки', async () => {
		const warn = vi.spyOn(logService, 'warn').mockImplementation(() => {});
		stashPrompt(new Error('not allowed'));

		expect(await promptInstall()).toBe('unavailable');
		expect(warn).toHaveBeenCalledWith('app', 'install prompt failed', expect.anything());
	});
});
