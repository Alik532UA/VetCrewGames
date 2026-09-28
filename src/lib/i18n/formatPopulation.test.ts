import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Налаштування підмінені, як і в `formatUserText.test.ts`: справжній синглтон у
 * конструкторі питає `window.matchMedia`, якого в jsdom немає. Мова змінна — кожен випадок
 * ставить свою; шрифт типовий, тож `formatFont` віддає рядок як є, без обгорток.
 */
const mocked = vi.hoisted(() => ({ settings: { font: 'default', locale: 'uk' } }));
vi.mock('$lib/services/settings.svelte', () => mocked);

const { formatPopulation } = await import('./index');
const { animals } = await import('$lib/config/population-game');

/** Число прописом мовою `locale`. */
function inLocale(locale: string, value: number): string {
	mocked.settings.locale = locale;
	return formatPopulation(value);
}

afterEach(() => {
	mocked.settings.locale = 'uk';
});

/**
 * ЧИСЕЛЬНІСТЬ — РОЗДІЛЮВАЧАМИ МОВИ СТОРІНКИ.
 *
 * Дефект: у гілках «тис», «млн», «млрд», «трлн» число склеювалося рядком JS, тобто завжди
 * з крапкою, — українська сторінка показувала «~1.2 млн», німецька «~4.5 Tausend». Мовою
 * сторінки число форматувала лише остання гілка, для чисел до тисячі.
 *
 * Зворотний експеримент: повернути `${value / 1_000_000}` у гілку мільйонів — червоніють
 * «мільйон» для uk, de і nl; прибрати `amount` з гілки тисяч — червоніє «тисяча».
 */
describe('formatPopulation', () => {
	it.each([
		['uk', '~1,2 млн'],
		['en', '~1.2 million'],
		['de', '~1,2 Millionen'],
		['nl', '~1,2 miljoen']
	])('%s: мільйон — «%s»', (locale, expected) => {
		expect(inLocale(locale, 1_200_000)).toBe(expected);
	});

	it.each([
		['uk', '~4,5 тис'],
		['en', '~4.5 thousand'],
		['de', '~4,5 Tausend'],
		['nl', '~4,5 duizend']
	])('%s: тисяча — «%s»', (locale, expected) => {
		expect(inLocale(locale, 4_500)).toBe(expected);
	});

	it.each([
		['uk', '~1,6 млрд', '~21 трлн'],
		['en', '~1.6 billion', '~21 trillion'],
		['de', '~1,6 Milliarden', '~21 Billionen'],
		['nl', '~1,6 miljard', '~21 biljoen']
	])('%s: мільярд і трильйон — «%s», «%s»', (locale, billion, trillion) => {
		expect(inLocale(locale, 1_600_000_000)).toBe(billion);
		expect(inLocale(locale, 21_000_000_000_000)).toBe(trillion);
	});

	it('ціле число лишається цілим, а до тисячі — без слова', () => {
		expect(inLocale('uk', 12_000_000)).toBe('~12 млн');
		expect(inLocale('uk', 999)).toBe('~999');
	});

	/*
	 * ОКРУГЛЕННЯ НЕ ЗМІНИЛОСЯ. `toLocaleString` типово лишає до трьох знаків після коми, а
	 * рядок JS лишав усі — тож на тварині з довшим дробом («1234567» → «1,234567 млн») число
	 * на екрані тихо стало б коротшим. У даних гри такої немає, і цей випадок це стереже:
	 * кожна тварина показує ті самі цифри, що й доти, лише з комою.
	 */
	it('кожна тварина гри — ті самі цифри, що й доти, лише з комою', () => {
		const divisors = [1_000_000_000_000, 1_000_000_000, 1_000_000, 1_000];
		const changed = animals.flatMap((animal) => {
			const divisor = divisors.find((d) => animal.population >= d) ?? 1;
			const digits = String(animal.population / divisor).replace('.', ',');
			const shown = inLocale('uk', animal.population);
			return shown.startsWith(`~${digits}`) && !/\d/.test(shown.charAt(digits.length + 1))
				? []
				: [`${animal.id}: ${animal.population} → ${shown}, а мало б «~${digits}…»`];
		});
		expect(animals.length, 'перевірка жива: тварин у грі немає').toBeGreaterThan(10);
		expect(changed).toEqual([]);
	});
});
