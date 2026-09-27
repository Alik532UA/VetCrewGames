import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './fixtures';
import { APP_PAGES } from './support/pages';
import { reduceMotion, settlePage } from './support/settle';

/**
 * ЗНАЧОК ПІСЛЯ ГІДРАЦІЇ ЦІЛИЙ: у кожному `svg` lucide рівно ті вузли, з яких складається він сам.
 *
 * ## Дефект, через який ця перевірка існує
 *
 * Двічі той самий. 2026-09-13 — кнопка теми: після перезавантаження у «Світло-зеленій» у
 * `svg` сонця лежав шлях МІСЯЦЯ з пререндера плюс вісім променів, а власного кола не було.
 * 2026-09-27 — плитка аватарки (`pairs-avatar-toggle-btn`): «змішані спотворені аватарки».
 * Перший раз виправлено точково, в одній кнопці, і клас дефекту лишився на місці.
 *
 * Механізм: сайт пререндериться, і в HTML потрапляє значок для ТИПОВОГО стану (темна тема,
 * силует без аватарки). Клієнт читає своє зі сховища й під час гідрації хоче інший значок.
 * Svelte 5 при цьому не перестворює вузли: `svelte:element` усередині lucide-`Icon` забирає
 * наявний вузол, НЕ звіряючи тег, і дописує на нього чужі атрибути — коло стає «шляхом» із
 * `d`, якого не малює, а бракує вузлів — дописує нові. Тексти й атрибути гідрація виправляє,
 * форму — ні.
 *
 * ## Чому звірка з самим lucide, а не «скільки svg у кнопці»
 *
 * Перша перевірка 2026-09-13 рахувала `svg` у кнопці, і він справді був один — дефект
 * жив у його ДІТЯХ. Тут кожен значок звіряється з `iconNode` свого ж файлу в `lucide-svelte`:
 * ті самі теги, ті самі атрибути, нічого зайвого. Звіряються ВСІ значки на ВСІХ сторінках,
 * а не одна кнопка: наступне місце з цим дефектом буде там, де його ще ніхто не шукав.
 *
 * ## Чому стан кладеться в сховище ДО завантаження
 *
 * Дефект існує лише тоді, коли стан відвідувача відрізняється від пререндера, і лише на
 * ПОВНОМУ завантаженні (переходи всередині застосунку гідрації не мають). Тож тема й
 * аватарка — не типові, і кожна сторінка відкривається `goto`, а не посиланням.
 */

/** Стан відвідувача, що відрізняється від пререндера: інша тема, власна аватарка. */
const VISITOR: Record<string, string> = {
	vetcrewgames_theme: 'light-green',
	'vetcrewgames_pairs.avatar': 'bird:blue'
};

type IconNode = [string, Record<string, string>][];

/** Вузли значка з його ж файлу в `lucide-svelte` (`const iconNode = [...]` — рядок JSON). */
function iconNode(name: string): IconNode | null {
	try {
		const source = readFileSync(`node_modules/lucide-svelte/dist/icons/${name}.svelte`, 'utf8');
		const literal = source.match(/const iconNode = (\[.*\]);/)?.[1];
		return literal ? (JSON.parse(literal) as IconNode) : null;
	} catch {
		return null;
	}
}

interface Drawn {
	name: string;
	where: string;
	/** Чи видно значок: у шапці лежать і сховані (`hidden`), їх звіряти теж, але «бачила» — лише видимі. */
	visible: boolean;
	nodes: IconNode;
}

/** Усі значки lucide на сторінці — з їхніми дітьми, як вони є в DOM. */
async function drawnIcons(page: Page): Promise<Drawn[]> {
	return page.evaluate(() =>
		[...document.querySelectorAll('svg.lucide-icon')].map((svg) => ({
			name:
				[...svg.classList]
					.find((token) => token.startsWith('lucide-') && token !== 'lucide-icon')
					?.slice('lucide-'.length) ?? '',
			where: svg.closest('[data-testid]')?.getAttribute('data-testid') ?? '(без testid)',
			visible: svg.getClientRects().length > 0,
			nodes: [...svg.children].map(
				(child) =>
					[
						child.tagName.toLowerCase(),
						Object.fromEntries([...child.attributes].map((attr) => [attr.name, attr.value]))
					] as [string, Record<string, string>]
			)
		}))
	);
}

/** Чим намальований значок відрізняється від свого `iconNode`; `null` — нічим. */
function difference(drawn: Drawn): string | null {
	const expected = iconNode(drawn.name);
	if (!expected) return `невідомий значок «${drawn.name}» — нема з чим звірити`;
	const shape = (nodes: IconNode) =>
		nodes.map(([tag, attrs]) => `${tag}(${JSON.stringify(Object.entries(attrs).sort())})`);
	const want = shape(expected);
	const got = shape(drawn.nodes);
	return JSON.stringify(want) === JSON.stringify(got)
		? null
		: `очікувано ${want.join(' ')}; намальовано ${got.join(' ')}`;
}

test('після повного завантаження кожен значок lucide складається зі своїх вузлів', async ({
	page
}) => {
	await page.addInitScript((pairs) => {
		for (const [key, value] of Object.entries(pairs)) window.localStorage.setItem(key, value);
	}, VISITOR);
	await reduceMotion(page);

	const broken: string[] = [];
	const seen = new Map<string, string>();

	for (const url of APP_PAGES) {
		await page.goto(url);
		await settlePage(page);
		for (const drawn of await drawnIcons(page)) {
			if (drawn.visible) seen.set(drawn.where, drawn.name);
			const problem = difference(drawn);
			if (problem) broken.push(`${url} ${drawn.where} lucide-${drawn.name}: ${problem}`);
		}
	}

	/*
	 * Передумова, без якої зелений результат нічого не значив би: перевірка БАЧИЛА значки,
	 * що відрізняються від пререндера, — аватарку відвідувача й значок його теми.
	 */
	expect(seen.get('pairs-avatar-toggle-btn'), 'аватарка відвідувача не дійшла до плитки').toBe(
		'bird'
	);
	expect(seen.get('header-theme-btn'), 'значок теми відвідувача не дійшов до шапки').toBe('sun');

	expect(broken, 'значки, змішані з пререндереними під час гідрації').toEqual([]);
});
