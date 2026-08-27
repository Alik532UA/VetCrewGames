// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * КОЖЕН `svelte-ignore` НЕСЕ ПРИЧИНУ (ACCESSIBILITY-v8 § 10.5, HIGH).
 *
 * ## Навіщо окремий гейт
 *
 * `svelte-ignore` глушить попередження КОМПІЛЯТОРА — переважно `a11y_*`. Тобто
 * це єдина директива в проєкті, якою можна зняти вимогу доступності одним
 * рядком, і зняти мовчки: `svelte-check` після неї чесно звітує 0 попереджень,
 * `eslint` таких правил не має взагалі (`svelte/a11y-*` не існує), axe бачить
 * лише те, що встигло потрапити в DOM під час прогону.
 *
 * Тобто всі чотири наявні гейти після такої директиви кажуть «чисто» — і кажуть
 * правду. Питання «а чому тут можна?» не ставить ніхто, і за півроку відповіді
 * на нього немає ні в кого.
 *
 * Пакет називає це прямо й ставить HIGH: «`svelte-ignore` без обґрунтування
 * заборонено». Правило текстове, гейта під ним не було.
 *
 * ## Що вважається обґрунтуванням
 *
 * Проза або в самій директиві, або в коментарі БЕЗПОСЕРЕДНЬО над нею — обидві
 * форми законні, і друга тут основна: усі три чинні місця пояснені абзацом
 * зверху, а не хвостом у тому ж рядку. Зразок у самому пакеті виглядає так
 * само.
 *
 * Коментар мусить бути ПОПЕРЕДНЬОЮ непорожньою конструкцією: між ним і
 * директивою дозволені лише пробіли й переноси рядка. Інакше «обґрунтуванням»
 * ставав би будь-який коментар, що трапився вище у файлі, — а таких у кожному
 * компоненті цього проєкту десятки.
 */

const SEPARATOR = String.fromCharCode(92);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else out.push(full.split(SEPARATOR).join('/'));
	}
	return out;
}

/**
 * Не лише `.svelte`: директиву розуміє компілятор рун, тож законне місце для неї
 * є і в `.svelte.ts` — саме там живе `state_referenced_locally`. Сьогодні таких
 * нуль, і сканер широкий рівно для того, щоб перший не проліз повз гейт.
 *
 * Тести виключені: цей файл цитує директиву прозою десяток разів.
 */
const components = walk('src').filter(
	(f) => (f.endsWith('.svelte') || f.endsWith('.svelte.ts')) && !/\.(test|spec)\./.test(f)
);

/** Директива в обох формах: розміткою (`<!-- … -->`) і в скрипті (`// …`). */
const DIRECTIVE = /svelte-ignore[ \t]+((?:[a-z0-9_]+[ \t]*)+)([^\n]*)/g;

/** Скільки літер має нести пояснення, щоб рахуватися поясненням. */
const MIN_PROSE = 20;

const letters = (text: string) => text.replace(/[^\p{L}]/gu, '').length;

/**
 * Коментар, який стоїть БЕЗПОСЕРЕДНЬО перед директивою.
 *
 * Три форми, бо саме стільки їх трапляється: блок розмітки `<!-- … -->`,
 * докблок `/** … *\/` і поспіль кілька рядків `//`. Порожні рядки між
 * коментарем і директивою пропускаються, а от будь-що інше — розмітка, код,
 * закритий тег — обриває пошук: інакше «поясненням» ставав би перший-ліпший
 * коментар вище за файлом.
 */
function commentAbove(source: string, at: number): string {
	const before = source.slice(0, at).replace(/[ \t]*$/, '');
	// Директива могла починатися з власного відкривача — знімаємо і його.
	const head = before.replace(/(<!--|\/\/|\/\*)[ \t]*$/, '').replace(/\s+$/, '');

	if (head.endsWith('-->')) {
		const open = head.lastIndexOf('<!--');
		return open === -1 ? '' : head.slice(open + 4, head.length - 3);
	}
	if (head.endsWith('*/')) {
		const open = head.lastIndexOf('/*');
		return open === -1 ? '' : head.slice(open + 2, head.length - 2);
	}

	const lines = head.split('\n');
	const run: string[] = [];
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i].trim();
		if (!line.startsWith('//')) break;
		run.unshift(line.slice(2));
	}
	return run.join(' ');
}

describe('svelte-ignore (ACCESSIBILITY-v8 § 10.5)', () => {
	const found = components.flatMap((file) => {
		const source = readFileSync(file, 'utf8');
		return [...source.matchAll(DIRECTIVE)].map((match) => ({
			file,
			rules: match[1].trim(),
			inline: match[2].replace(/-->|\*\//g, ''),
			above: commentAbove(source, match.index ?? 0)
		}));
	});

	it('перевірка жива: компоненти прочитано й директиви знайдено', () => {
		/*
		 * Два різні твердження. Перше ловить сканер, що дивиться не в ту теку;
		 * друге — випадок, коли директив не лишилося зовсім: тоді перевірка
		 * зеленіє, нічого не перевіривши, і про це варто знати, а не заспокоїтися.
		 * На момент коміту їх три; при нулі рядок треба свідомо прибрати разом із
		 * файлом, а не лишати гейт, який міряє порожнечу.
		 */
		expect(components.length, 'компонентів не знайдено').toBeGreaterThan(60);
		expect(found.length, 'жодної директиви — перевіряти нічого').toBeGreaterThan(0);
	});

	it('кожна директива пояснена — у собі або в коментарі просто над нею', () => {
		const bare = found
			.filter(({ inline, above }) => letters(inline) + letters(above) < MIN_PROSE)
			.map(({ file, rules }) => `${file}: svelte-ignore ${rules} — без причини`);

		expect(
			bare,
			`попередження компілятора зняте мовчки; жоден інший гейт цього не бачить:\n${bare.join('\n')}`
		).toEqual([]);
	});
});
