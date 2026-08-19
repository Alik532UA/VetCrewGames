// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Український текст на екрані проходить через `formatFont()`.
 *
 * Шрифт `inglobal` — типовий у проєкті — не має глифів для «і», «ї», «є», «ґ».
 * Коли глифа немає, браузер підставляє ЧУЖИЙ шрифт саме для цієї літери, і
 * слово розпадається: виміряно на 32px — кирилична «і» займає 8.89px проти
 * 6.63px у латинської, тобто на 34% ширша й помітно інша на вигляд.
 *
 * `formatFont()` це й лікує: «і» замінює на латинську «i» (той самий шрифт має
 * її глиф), а «ї», «є», «ґ» обгортає у span із запасним шрифтом. У словниках
 * при цьому лежить ПРАВИЛЬНА кирилиця — підміна відбувається лише на показі.
 *
 * Це не стилістика й не дрібниця. Спроба вирішити те саме хардкодом латинської
 * «i» просто в словниках уже провалилася: половину місць пропустили, а
 * виправлені зламали пошук, копіювання й читалку. Різниця в тому, ЩО саме
 * замінюють: символ у джерелі — назавжди, символ на показі — лише для очей.
 *
 * **Чого перевірка НЕ бачить.** Вона читає лише розмітку: `t()`, викликаний у
 * `<script>` і покладений у змінну, крізь неї проходить. Тому місця, де підпис
 * обчислюється заздалегідь, переписані так, щоб форматування лишалося в
 * розмітці — не з любові до однорідності, а щоб цей інваріант їх покривав.
 */

const IGNORED_DIRS = new Set(['node_modules', '.svelte-kit', 'build', 'dist']);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (IGNORED_DIRS.has(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else out.push(full.replace(/\\/g, '/'));
	}
	return out;
}

/**
 * Кінець тега, з урахуванням лапок і фігурних дужок.
 *
 * Регулярний вираз тут не працює: в атрибуті живе `onclick={() => reset()}`, і
 * `>` зі стрілки обриває тег на середині.
 */
function endOfTag(markup: string, from: number): number {
	let depth = 0;
	let quote = '';
	for (let i = from; i < markup.length; i++) {
		const ch = markup[i];
		if (quote) {
			if (ch === quote) quote = '';
			continue;
		}
		if (ch === '"' || ch === "'") quote = ch;
		else if (ch === '{') depth++;
		else if (ch === '}') depth--;
		else if (ch === '>' && depth === 0) return i;
	}
	return markup.length;
}

/**
 * Куски розмітки ПОЗА тегами — тобто те, що людина бачить як текст.
 *
 * Атрибути свідомо лишаються за межами: `aria-label` і `title` читає машина, і
 * латинська «i» всередині українського слова змусила б читалку вимовити його
 * неправильно. Там кирилиця має лишатися кирилицею.
 */
function textRegions(markup: string): string[] {
	const out: string[] = [];
	let cursor = 0;
	let i = 0;

	while (i < markup.length) {
		const lt = markup.indexOf('<', i);
		if (lt === -1) break;
		if (!/[/!a-zA-Z]/.test(markup[lt + 1] ?? '')) {
			i = lt + 1;
			continue;
		}
		out.push(markup.slice(cursor, lt));
		const gt = endOfTag(markup, lt + 1);
		cursor = gt + 1;
		i = gt + 1;
	}
	out.push(markup.slice(cursor));
	return out;
}

/** Вирази `{…}` із урахуванням вкладених дужок. */
function expressions(text: string): string[] {
	const out: string[] = [];
	for (let i = 0; i < text.length; i++) {
		if (text[i] !== '{') continue;
		let depth = 0;
		let j = i;
		for (; j < text.length; j++) {
			if (text[j] === '{') depth++;
			else if (text[j] === '}' && --depth === 0) break;
		}
		out.push(text.slice(i, j + 1));
		i = j;
	}
	return out;
}

/** Виклик словника: `t(…)` або `td(…)`, але не `at(`, `filter(` і подібні. */
const DICTIONARY_CALL = /(^|[^\w$.])t d?\(|(^|[^\w$.])td?\(/;

/** Форматери, які вже роблять підміну. Обидва повертають готову розмітку. */
const FORMATTERS = /formatFont|formatPopulation/;

describe('український текст на екрані', () => {
	const components = walk('src').filter((f) => f.endsWith('.svelte'));

	it('перевірка жива: компоненти знайдено', () => {
		expect(components.length).toBeGreaterThan(10);
	});

	it('перевірка жива: текстові куски відрізняються від атрибутів', () => {
		const markup = `<button aria-label={t('a')}>{t('b')}</button>`;
		const joined = textRegions(markup).join('|');
		expect(joined, 'атрибут потрапив у текст').not.toContain("t('a')");
		expect(joined, 'текст не знайдено').toContain("t('b')");
	});

	/**
	 * Кожен видимий `t()` обгорнутий у `formatFont`.
	 *
	 * Без цього кирилична «і» доїжджає до сторінки як є, шрифт її не має, і
	 * браузер малює одну літеру чужим шрифтом. На екрані це виглядає як
	 * друкарський брак, а `svelte-check` і eslint не бачать нічого: з погляду
	 * коду `{t('reserve.animals')}` бездоганний.
	 */
	it('видимий текст зі словника проходить через formatFont', () => {
		const problems: string[] = [];

		for (const file of components) {
			const source = readFileSync(file, 'utf8');
			const markup = source
				.slice(source.indexOf('</script>') + 1)
				.replace(/<style[\s\S]*<\/style>/, '')
				.replace(/<!--[\s\S]*?-->/g, '');

			for (const region of textRegions(markup)) {
				for (const expression of expressions(region)) {
					if (!DICTIONARY_CALL.test(expression)) continue;
					if (FORMATTERS.test(expression)) continue;
					problems.push(`${file}: ${expression.replace(/\s+/g, ' ').slice(0, 70)}`);
				}
			}
		}

		expect(
			problems,
			`кирилична «і» доїде до сторінки й намалюється чужим шрифтом.\n` +
				`Обгорнути: {@html formatFont(t('…'))}\n${problems.join('\n')}`
		).toEqual([]);
	});

	/**
	 * У словниках лежить ПРАВИЛЬНА кирилиця.
	 *
	 * Це друга половина того самого правила, і без неї перша марна. Хардкод
	 * латинської «i» в перекладі ламає те, чого око не бачить: пошук по сайту,
	 * копіювання тексту, читалку й індексацію. Замінювати символ можна лише на
	 * показі — у джерелі він мусить бути тим, чим є.
	 */
	it('в українському словнику немає латиниці всередині слів', () => {
		const dictionaries = walk('src/lib/i18n/translations/uk');
		expect(dictionaries.length, 'словників не знайдено — перевірка осліпла').toBeGreaterThan(3);

		/*
		 * Файл читається ЦІЛКОМ, без спроби вибрати з нього рядкові літерали.
		 *
		 * Перша версія витягувала їх виразом `'([^'\\]*)'` — і мовчки сліпла на
		 * першому ж екранованому апострофі («П\'ятикратна швидкість»): далі пари
		 * лапок зсувалися на одну, і решта файлу читалася як попало. Перевірка
		 * при цьому лишалася зеленою, тобто була гіршою за відсутню. Знайшов це
		 * зворотний експеримент, а не око.
		 *
		 * Цілий файл тут безпечний: ключі («reserve.animals») суто латинські,
		 * коментарі — суцільна українська, і ні в тих, ні в тих двох алфавітів в
		 * ОДНОМУ слові не буває.
		 */
		const problems: string[] = [];
		for (const file of dictionaries) {
			for (const word of readFileSync(file, 'utf8').split(/[^\p{L}]+/u)) {
				if (/\p{Script=Cyrillic}/u.test(word) && /\p{Script=Latin}/u.test(word)) {
					problems.push(`${file}: «${word}»`);
				}
			}
		}

		expect(
			problems,
			`кирилиця з латиницею в одному слові — ламає пошук, копіювання й читалку:\n${problems.join('\n')}`
		).toEqual([]);
	});
	/**
	 * Друга половина того самого правила: те, що читає МАШИНА, не форматується.
	 *
	 * Docблок цього файлу стверджував це від початку — «атрибути свідомо
	 * лишаються за межами: `aria-label` і `title` читає машина, і латинська „i“
	 * всередині українського слова змусила б читалку вимовити його неправильно».
	 * Стверджував — і не перевіряв, тож правило порушувалося у ДВАДЦЯТИ ОДНОМУ
	 * місці: `aria-label={formatPlain(t('header.toggleTheme'))}` давав читалці
	 * «Змiнити тему» з латинською i, і так само були зіпсовані всі `alt` до фото
	 * тварин — тобто саме той текст, який чує людина, що не бачить зображення.
	 *
	 * `label` тут теж перелічений, бо в цьому проєкті він доходить до
	 * `aria-label` компонента (`HeaderMenu`, `FeedingVerdicts`). Якщо колись
	 * зʼявиться компонент, який `label` МАЛЮЄ, форматувати його треба всередині
	 * компонента, а не на місці виклику: хто малює, той і знає, що це показ, а
	 * не оголошення.
	 */
	it('машинні підписи НЕ проходять через форматери шрифту', () => {
		const MACHINE_READ = ['aria-label', 'alt', 'title', 'placeholder', 'label'];
		const FONT_FORMATTERS = ['formatPlain(', 'formatFont(', 'formatPopulation('];

		const problems: string[] = [];
		let seen = 0;

		for (const file of components) {
			const source = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
			for (const attribute of MACHINE_READ) {
				// Саме `attr={`, а не `attr:` — щоб не зачепити поле обʼєкта, яке
				// цілком законно малюється (пункти меню тем).
				const needle = `${attribute}={`;
				let from = 0;
				for (;;) {
					const at = source.indexOf(needle, from);
					if (at === -1) break;
					from = at + needle.length;
					// `data-label={`, `xyz-label={` — інші атрибути, не цей.
					const before = source[at - 1] ?? ' ';
					if (/[\w$-]/.test(before)) continue;
					seen++;
					const value = source.slice(from, from + 40);
					const formatter = FONT_FORMATTERS.find((f) => value.startsWith(f));
					if (formatter) {
						problems.push(`${file}: ${attribute}={${formatter}…}`);
					}
				}
			}
		}

		// Canary: змінена розмітка або зламаний обхід дали б нуль знахідок і зелений тест.
		expect(seen, 'машинних підписів не знайдено — шукали не там').toBeGreaterThan(20);
		expect(
			problems,
			`читалка вимовить це покручем — кирилиця мусить лишитися кирилицею.\n` +
				`Прибрати форматер; він потрібен лише тому, що МАЛЮЄТЬСЯ:\n${problems.join('\n')}`
		).toEqual([]);
	});
});
