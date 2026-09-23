import { describe, expect, it, vi } from 'vitest';

/*
 * Налаштування підмінені, як і в решті тестів: справжній синглтон у конструкторі
 * питає `window.matchMedia`, якого в jsdom немає. Шрифт — типовий `inglobal`,
 * тобто той, під яким `formatFont` справді щось робить.
 */
vi.mock('$lib/services/settings.svelte', () => ({ settings: { font: 'inglobal', locale: 'uk' } }));

const { formatUserText } = await import('./index');

/**
 * ТЕКСТ ВІД ЛЮДИНИ В `{@html}` — лише екранований.
 *
 * Імʼя в таблиці лідерів пише сам гравець, а правило бази обмежує його лише
 * довжиною. Доти воно йшло в `{@html}` через `formatFont`, який нічого не екранує:
 * посилання чи стиль на весь екран ставали розміткою сторінки (аудит 2026-09-23).
 *
 * Зворотний експеримент: у `formatUserText` прибрати `replace` — червоніють три
 * перші випадки.
 */
describe('formatUserText', () => {
	it('розмітка стає текстом', () => {
		const out = formatUserText('<a href=//evil>Приз</a>');
		expect(out).not.toContain('<a ');
		expect(out).toContain('&lt;a href=//evil&gt;');
	});

	it('стиль на весь екран — теж лише текст', () => {
		const out = formatUserText('<b style=position:fixed;inset:0>x</b>');
		expect(out).not.toContain('<b ');
		expect(out).toContain('&lt;b style=');
	});

	it('амперсанд і лапки екрануються', () => {
		expect(formatUserText('A & "B" \'C\'')).toContain('A &amp; &quot;B&quot; &#39;C&#39;');
	});

	it('форматування літер лишається: «Ї» у запасному шрифті, як і в словнику', () => {
		const out = formatUserText('Їжак');
		expect(out).toMatch(/<span class="font-comfortaa"[^>]*>Ї<\/span>/);
	});
});
