// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * «Звірені факти» з PROJECT-CONTEXT.md проти самого коду.
 *
 * **Навіщо.** Алгоритм застосування пакета (README v8, крок 2) велить читати
 * `PROJECT-CONTEXT.md` ДРУГИМ кроком — саме звідти агент дізнається профіль,
 * префікс сховища й перелік застосовних файлів. Тобто це вхідні дані для всієї
 * решти роботи, і при цьому єдиний шар проєкту, якого не бачить жоден гейт:
 * `svelte-check` документів не читає, `eslint` теж, а зібраний `build/` про них
 * не знає.
 *
 * Наслідок був виміряний, а не уявний. Аудит 2026-08-18 знайшов шість
 * розбіжностей, і три з них міняли ЗАСТОСОВНІСТЬ файлів пакета: документ казав,
 * що мов дві (їх чотири) і що полів вводу немає (їх шість, і на цьому два файли
 * пакета випадали з розгляду). Помилки такого сорту не проявляються ніяк — вони
 * просто роблять наступний висновок неправильним.
 *
 * **Чому саме таблиця з маркерами, а не розбір усього тексту.** Проза
 * змінюється щокоміту, і перевірка, що чіпляється за формулювання, червоніє від
 * переписаного речення. Тому звіряються лише рядки між `FACTS:BEGIN` і
 * `FACTS:END`: короткий перелік фактів, у кожного — свій резолвер нижче.
 *
 * Список звіряється в ОБИДВА боки. Рядок без резолвера — це факт, який ніхто не
 * перевіряє; резолвер без рядка — це перевірка, яку зняли видаленням рядка з
 * документа. Обидва стани мовчазні, тому обидва падають.
 */

const DOC = 'PROJECT-CONTEXT.md';
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

const read = (file: string) => readFileSync(file, 'utf8');

/**
 * Значення факту, обчислене з ДЖЕРЕЛА ІСТИНИ — тієї самої, що названа в
 * останній колонці таблиці.
 *
 * Кожен резолвер спершу переконується, що знайшов те, що шукав: джерело могли
 * перейменувати, і тоді «не знайшов» мусить бути падінням, а не порожнім
 * рядком, який випадково збігся з порожнім очікуванням.
 */
const RESOLVERS: Record<string, () => string> = {
	/** Мови, які сайт СПРАВДІ віддає. Найдорожчий рядок: він визначає обсяг I18N. */
	languages() {
		const source = read('src/lib/i18n/routing.ts');
		const list = source.match(/export const LANGUAGES: readonly Language\[\] = \[([^\]]*)\]/)?.[1];
		expect(list, 'у routing.ts не знайдено LANGUAGES — джерело перейменували').toBeTruthy();
		return [...(list as string).matchAll(/'([a-z]{2})'/g)].map((m) => m[1]).join(', ');
	},

	/** Префікс сховища. Origin спільний із шістьма застосунками — ціна помилки чужі дані. */
	'storage-prefix'() {
		const prefix = read('src/lib/services/storage.ts').match(/const PREFIX = '([^']+)'/)?.[1];
		expect(prefix, 'у storage.ts не знайдено PREFIX — джерело перейменували').toBeTruthy();
		return prefix as string;
	},

	/** Порти емулятора: саме вони згадані в «Локальних пастках» як не-типові. */
	'emulator-ports'() {
		const config = JSON.parse(read('firebase.json')) as {
			emulators?: Record<string, { port?: number }>;
		};
		const ports = config.emulators;
		expect(ports, 'у firebase.json немає блоку emulators').toBeTruthy();
		return `database ${ports?.database?.port}, auth ${ports?.auth?.port}, ui ${ports?.ui?.port}`;
	},

	/** Адаптер визначає профіль (static / server), а з ним — половину пакета. */
	adapter() {
		const from = read('svelte.config.js').match(/import adapter from '([^']+)'/)?.[1];
		expect(from, 'у svelte.config.js не знайдено імпорт адаптера').toBeTruthy();
		return from as string;
	},

	/**
	 * Чи описана пара тем через `light-dark()`.
	 *
	 * Рядок «не застосовується» у «Прийнятих рішеннях» пережив власне скасування
	 * на два тижні: 2026-08-16 функцію справді відкинули («знає рівно дві схеми,
	 * а тем тут чотири»), 2026-08-23 пару `dark`/`light-green` перевели на неї
	 * цілком — і той самий файл почав казати обидві речі одразу. Клас той самий,
	 * що з «немає входу» й «немає полів вводу»: причина відмови старіє раніше,
	 * ніж її перечитають, а наступний висновок роблять уже з неї.
	 *
	 * Ціна тут не косметична. З «не застосовується» випливає, що правила
	 * `UIUX-LIGHT-DARK-*` (UI-UX-v8 § 1.5.1.1–1.5.1.3, HIGH) цього проєкту не
	 * стосуються — зокрема те, через яке неколірний аргумент мовчки прибрав тіні
	 * в трьох сусідніх проєктах.
	 *
	 * Коментарі знімаються перед пошуком: теми описують механізм `light-dark()`
	 * прозою, разом із поламаними формами, яких у коді саме НЕМАЄ.
	 */
	'light-dark'() {
		const themes = walk('src/lib/styles/themes').filter((f) => f.endsWith('.css'));
		expect(themes.length, 'тем не знайдено — перевірка осліпла').toBeGreaterThan(0);
		const used = themes.some((file) =>
			/light-dark\(/.test(read(file).replace(/\/\*[\s\S]*?\*\//g, ' '))
		);
		return used ? 'застосовується' : 'не застосовується';
	},

	/**
	 * Поля, за якими база читає НЕ за ключем.
	 *
	 * Рядок протермінувався мовчки, і саме так, як протерміновуються всі рядки
	 * цього файлу: документ казав «індекси не потрібні, проєкт читає виключно за
	 * ключем», а `orderByChild('at')` і `orderByChild('score')` уже приїхали
	 * разом із переліком кімнат і таблицею лідерів. Помилка нешкідлива рівно
	 * доти, доки хтось не зробить із неї висновок — наприклад, «індексів тут
	 * немає, отже § 7.4 незастосовний».
	 *
	 * Що `.indexOn` СТОЇТЬ на своїй гілці — окреме твердження, і його тримає
	 * `src/cloud-database.test.ts`. Тут звіряється лише перелік.
	 */
	'rtdb-indexes'() {
		const fields = new Set<string>();
		for (const file of walk('src/lib/net').filter((f) => f.endsWith('.ts'))) {
			/*
			 * Коментарі знімаються ПЕРЕД пошуком. Перша редакція цього не робила й
			 * знайшла третє поле — `info/hostUid` із докблока `ownRooms.ts`, де воно
			 * згадане як приклад запиту, якого тут САМЕ НЕМАЄ. Пошук по сирому тексту
			 * приписав би базі індекс, якого вона не має й не потребує.
			 */
			const code = read(file)
				.replace(/\/\*[\s\S]*?\*\//g, ' ')
				.replace(/(^|[^:])\/\/.*/g, '$1 ');
			for (const match of code.matchAll(/orderByChild\(\s*'([^']+)'/g)) fields.add(match[1]);
		}
		return [...fields].sort().join(', ');
	},

	/**
	 * Чи є в застосунку поля вводу.
	 *
	 * Рядок виглядає дрібницею, і саме він протермінувався: на «полів вводу тут
	 * немає» трималося рішення не застосовувати FORM-INPUTS та INPUT-TOOLS.
	 * `type="hidden"` не рахується — це не поле, яке хтось заповнює.
	 */
	'text-inputs'() {
		const components = walk('src').filter((f) => f.endsWith('.svelte'));
		expect(components.length, 'компонентів не знайдено — перевірка осліпла').toBeGreaterThan(0);
		const found = components.some((file) => {
			const markup = read(file);
			if (/<textarea\b/.test(markup)) return true;
			return [...markup.matchAll(/<input\b[\s\S]*?\/?>/g)].some(
				(m) => !/type\s*=\s*["']hidden["']/.test(m[0])
			);
		});
		return found ? 'є' : 'немає';
	}
};

/** Рядки таблиці між маркерами: `| id | значення | джерело |`. */
function factsFromDoc(): Map<string, string> {
	const doc = read(DOC);
	const block = doc.match(/<!--\s*FACTS:BEGIN[\s\S]*?-->([\s\S]*?)<!--\s*FACTS:END\s*-->/)?.[1];
	expect(block, `у ${DOC} немає блоку між FACTS:BEGIN і FACTS:END`).toBeTruthy();

	const facts = new Map<string, string>();
	for (const line of (block as string).split('\n')) {
		// Роздільник заголовка (`| --- | --- |`) і сам заголовок пропускаються.
		const cells = line.split('|').slice(1, -1);
		if (cells.length < 3 || /^[\s-]+$/.test(cells[0])) continue;
		const id = cells[0].trim().replace(/^`|`$/g, '');
		const value = cells[1].trim().replace(/^`|`$/g, '');
		if (id === 'ID') continue;
		facts.set(id, value);
	}
	return facts;
}

describe(`звірені факти PROJECT-CONTEXT.md`, () => {
	const facts = factsFromDoc();

	it('перевірка жива: таблицю фактів знайдено', () => {
		expect(facts.size, 'блок є, а рядків у ньому немає — таблиця розʼїхалася').toBeGreaterThan(0);
	});

	it('кожен рядок таблиці має резолвер, і навпаки', () => {
		// Обидва боки навмисно. Рядок без резолвера — факт, якого ніхто не
		// перевіряє; резолвер без рядка — гейт, знятий видаленням рядка з
		// документа. Одностороння перевірка ловила б лише перше.
		const unchecked = [...facts.keys()].filter((id) => !(id in RESOLVERS));
		const orphaned = Object.keys(RESOLVERS).filter((id) => !facts.has(id));
		expect(
			{ unchecked, orphaned },
			'рядок без резолвера ніхто не перевіряє; резолвер без рядка — це знятий гейт'
		).toEqual({ unchecked: [], orphaned: [] });
	});

	it.each([...facts.keys()].filter((id) => id in RESOLVERS))(
		'%s: документ каже те саме, що й код',
		(id) => {
			expect(
				RESOLVERS[id](),
				`PROJECT-CONTEXT.md каже «${facts.get(id)}» — код каже інше. Правити документ, а не тест.`
			).toBe(facts.get(id));
		}
	);
});
