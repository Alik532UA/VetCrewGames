// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * КНОПКА «НА ВЕСЬ ЕКРАН» ХОВАЄТЬСЯ ДО ГІДРАЦІЇ — і тією самою умовою, що в сервісі
 * (прохання автора 2026-09-26: на iPhone кнопка, яка не працює, виглядала як баг).
 *
 * Скрипт першого кадру (`src/app.html`) не може імпортувати `canFullscreen`, тож
 * умова існує у двох місцях. Розійдуться вони МОВЧКИ: до гідрації кнопка є, після —
 * немає (або навпаки), і шапка стрибає. Тому скрипт тут ВИКОНУЄТЬСЯ — на
 * підставних документах із кожною комбінацією ознак, — а не звіряється текстом.
 *
 * Зворотний експеримент: прибрати зі скрипта `webkitFullscreenEnabled` —
 * червоніє «старий WebKit»; прибрати правило зі стилів шапки — червоніє «правило».
 */

const APP_HTML = 'src/app.html';
const HEADER = 'src/lib/components/GameHeader.svelte';
const SERVICE = 'src/lib/services/fullscreen.svelte.ts';

const html = readFileSync(APP_HTML, 'utf8');

/** Тіло інлайн-скрипта першого кадру — рівно те, що виконає браузер. */
const firstFrame = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

/** Прогнати скрипт першого кадру на документі з такими ознаками. */
function classesAfterFirstFrame(features: Record<string, unknown>): string[] {
	const classes = new Set<string>();
	const documentElement = {
		setAttribute: () => {},
		classList: { add: (name: string) => classes.add(name) }
	};
	const document = { documentElement, querySelector: () => null, ...features };
	const window = { matchMedia: () => ({ matches: false }) };
	const localStorage = { getItem: () => null };
	// Окремий контекст, а не `new Function`: скрипт бачить рівно ці три імені — як
	// браузер на першому кадрі, коли застосунку ще немає.
	runInNewContext(firstFrame, { document, window, localStorage });
	return [...classes];
}

describe('кнопка «на весь екран» до гідрації', () => {
	it('перевірка жива: скрипт першого кадру знайдено', () => {
		expect(firstFrame).toContain('fullscreenEnabled');
	});

	it('не вміє (iPhone) — клас ставиться', () => {
		expect(classesAfterFirstFrame({})).toContain('no-fullscreen');
	});

	it('вміє — класу немає', () => {
		expect(classesAfterFirstFrame({ fullscreenEnabled: true })).not.toContain('no-fullscreen');
	});

	it('старий WebKit — теж уміє', () => {
		expect(classesAfterFirstFrame({ webkitFullscreenEnabled: true })).not.toContain(
			'no-fullscreen'
		);
	});

	it('та сама умова, що в сервісі', () => {
		const service = readFileSync(SERVICE, 'utf8');
		expect(service).toContain('doc.fullscreenEnabled || doc.webkitFullscreenEnabled');
		expect(firstFrame).toContain('document.fullscreenEnabled || document.webkitFullscreenEnabled');
	});

	it('правило, що ховає кнопку, — у стилях шапки, а кнопка має його клас', () => {
		const header = readFileSync(HEADER, 'utf8');
		expect(header).toMatch(
			/:global\(html\.no-fullscreen\) \.fullscreen-btn \{\s*display: none;\s*\}/
		);
		expect(header).toMatch(/class="header-btn fullscreen-btn"/);
	});
});
