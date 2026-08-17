// @vitest-environment node
// Перевірка читає файли — DOM їй не потрібен.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANGUAGE_ROUTES, type RouteRest } from '$lib/i18n/routing';
import {
	BETA_TABS,
	BETA_UNCOVERED_ROUTES,
	allBetaChecks,
	sortedChecks,
	type BetaCheck
} from './betaChecks';

/**
 * Інваріанти чеклиста бета-тестування.
 *
 * **Чому чеклист узагалі має перевірки.** Найдорожча пастка таких списків —
 * не помилка в пункті, а ВІДСТАВАННЯ: код змінився, пункт лишився, і людина
 * ставить «перевірено» на тому, чого вже немає. У сусідньому проєкті
 * (`AndDvergrShallSpeakAI/Checklists`) це записано правилом «як помітити, що
 * чеклист відстав від коду» — з чесним post-mortem про професію, яка існувала
 * десятки комітів без жодного пункта. Правило в документі помічає це тоді, коли
 * хтось документ перечитає; тут те саме помічає `npm test`.
 *
 * Три інваріанти роблять основну роботу, і кожен закриває свій спосіб відстати:
 *
 *  1. кожен маршрут заявлений вкладкою — нова гра без пунктів валить прогін;
 *  2. `covered` називає файл тесту, і файл існує — видалений тест не лишає по
 *     собі пункта, який мовчки обіцяє покриття;
 *  3. названий `data-testid` існує в коді — пункт не може просити натиснути
 *     кнопку, якої більше немає.
 */

const svelteFiles = (dir: string, out: string[] = []): string[] => {
	for (const entry of readdirSync(dir)) {
		if (['node_modules', '.svelte-kit', 'build'].includes(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) svelteFiles(full, out);
		else if (entry.endsWith('.svelte')) out.push(full.replace(/\\/g, '/'));
	}
	return out;
};

const markup = svelteFiles('src')
	.map((file) => readFileSync(file, 'utf8'))
	.join('\n');

/**
 * Усі локатори, які проєкт СПРАВДІ малює.
 *
 * Проста перевірка «чи є в джерелах рядок `data-testid="…"`» тут не працює, і на
 * цьому вже згорів пункт про тему. Локатор у цьому проєкті буває складеним із
 * ДВОХ файлів: `HeaderControls.svelte` передає `testId="header-theme"`, а
 * `HeaderMenu.svelte` малює `data-testid="{testId}-btn"`. Рядка
 * `header-theme-btn` немає ніде — отже пункт, який на нього посилається,
 * виглядав би помилковим, а пункт БЕЗ локатора проходив би без перевірки взагалі.
 * Саме так стара логіка теми й прожила 46 комітів у чеклисті: я прибрав локатор,
 * коли він не знайшовся, замість піти за тим, що знайшлося.
 *
 * Тому тут локатори збираються так, як їх збирає браузер:
 *
 *  * літерали `data-testid="reserve-card-close-btn"` — як є;
 *  * шаблони `data-testid="reserve-animal-{animal.id}-btn"` — динамічна частина
 *    стає `*`, і пункт має право написати `reserve-animal-*-btn`;
 *  * шаблон, що ПОЧИНАЄТЬСЯ з `{testId}`, розкривається кожним значенням
 *    `testId="…"`, яке є в проєкті: звідси й беруться `header-theme-btn` і
 *    `memory-game-over-play-again-btn`.
 */
const star = (id: string) => id.replace(/\$?\{[^}]*\}/g, '*');

function knownLocators(): Set<string> {
	const ids = new Set<string>();
	const raw = [...markup.matchAll(/data-testid=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(
		(m) => m[1] ?? m[2]
	);
	// Значення пропа `testId`: і бази («header-theme»), і готові шаблони
	// («memory-card-btn-{slot.card.id}»).
	const props = [...markup.matchAll(/\btestId=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(
		(m) => m[1] ?? m[2]
	);

	const bases = props.filter((value) => !value.includes('{'));
	for (const value of props) if (value.includes('{')) ids.add(star(value));

	for (const id of raw) {
		if (!id.includes('{')) {
			ids.add(id);
			continue;
		}
		if (/^\$?\{/.test(id)) {
			// Перший сегмент динамічний — сам собою він не означає нічого
			// («*-btn» підійшло б до будь-чого). Розкриваємо його базами.
			for (const base of bases) ids.add(star(id.replace(/^\$?\{[^}]*\}/, base)));
			continue;
		}
		ids.add(star(id));
	}
	return ids;
}

const LOCATORS = knownLocators();

const checks = allBetaChecks();
const withId = (list: BetaCheck[]) => list.map((check) => check.id).join(', ');

describe('чеклист бета-тестування', () => {
	it('перевірка жива: вкладки й пункти знайдено', () => {
		expect(BETA_TABS.length).toBeGreaterThanOrEqual(8);
		expect(checks.length).toBeGreaterThanOrEqual(60);
	});

	/**
	 * `id` — ключ прогресу в сховищі. Дублікат означає, що двоє пунктів мають одну
	 * галочку: позначив один — «перевірився» й другий.
	 */
	it('id унікальні', () => {
		const seen = new Map<string, number>();
		for (const check of checks) seen.set(check.id, (seen.get(check.id) ?? 0) + 1);
		const duplicates = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
		expect(duplicates, `однакові id: ${duplicates.join(', ')}`).toEqual([]);
	});

	it('id складається з назви вкладки й номера', () => {
		const bad: string[] = [];
		for (const tab of BETA_TABS) {
			for (const check of tab.checks) {
				if (!new RegExp(`^${tab.id}_\\d{1,3}$`).test(check.id)) bad.push(`${tab.id}: ${check.id}`);
			}
		}
		expect(bad, `id не за формою {вкладка}_{номер}:\n${bad.join('\n')}`).toEqual([]);
	});

	/**
	 * ГОЛОВНИЙ інваріант: нова гра без пунктів чеклиста валить прогін.
	 *
	 * Саме тому вкладка називає МАРШРУТИ, а не «гру» словами: перелік маршрутів у
	 * проєкті вже є, і його ніхто не забуде поповнити — без нього сторінки просто
	 * не буде. Другий список, який треба тримати узгодженим руками, розійшовся б
	 * із першим на першій же грі.
	 */
	it('кожен маршрут заявлений рівно однією вкладкою', () => {
		const claimed = new Map<string, string[]>();
		for (const tab of BETA_TABS) {
			for (const route of tab.routes) {
				claimed.set(route, [...(claimed.get(route) ?? []), tab.id]);
			}
		}

		const routes = Object.keys(LANGUAGE_ROUTES) as RouteRest[];
		const uncovered = routes.filter(
			(route) => !claimed.has(route) && !BETA_UNCOVERED_ROUTES.includes(route)
		);
		expect(
			uncovered,
			`маршрути без жодного пункта чеклиста — гра є, перевіряти її нічим:\n${uncovered.join('\n')}`
		).toEqual([]);

		const twice = [...claimed].filter(([, tabs]) => tabs.length > 1);
		expect(
			twice.map(([route, tabs]) => `${route}: ${tabs.join(' і ')}`),
			'маршрут заявлено двома вкладками — незрозуміло, де його пункти'
		).toEqual([]);

		const unknown = [...claimed.keys()].filter((route) => !(route in LANGUAGE_ROUTES));
		expect(unknown, `вкладка тримає маршрут, якого немає: ${unknown.join(', ')}`).toEqual([]);
	});

	/**
	 * Твердження про покриття мусить бути перевірним, інакше воно гниє швидше за
	 * сам чеклист: тест видалили, пункт лишився зеленим і внизу списку, і людина
	 * його пропускає.
	 */
	it('covered називає файл тесту, і файл існує', () => {
		const missingField = checks.filter((check) => check.coverage === 'covered' && !check.test);
		expect(missingField, `covered без файлу тесту: ${withId(missingField)}`).toEqual([]);

		const missingFile = checks.filter((check) => check.test && !existsSync(check.test));
		expect(
			missingFile.map((check) => `${check.id} → ${check.test}`),
			'названого файлу тесту немає на диску'
		).toEqual([]);
	});

	it('manual і testable не називають тесту', () => {
		const wrong = checks.filter((check) => check.coverage !== 'covered' && check.test);
		expect(
			wrong.map((check) => `${check.id} (${check.coverage}) → ${check.test}`),
			'пункт оголошений непокритим, але називає тест — одне з двох неправда'
		).toEqual([]);
	});

	/**
	 * Наша відповідь на «чеклист відстав від коду» з боку розмітки: пункт, який
	 * просить натиснути щось конкретне, називає локатор — і локатор мусить існувати.
	 */
	it('перевірка жива: локатори зібрано, зокрема складені', () => {
		expect(LOCATORS.size).toBeGreaterThan(100);
		// Складений із двох файлів: `testId="header-theme"` плюс `{testId}-btn`.
		expect(LOCATORS.has('header-theme-btn'), 'складені локатори не збираються').toBe(true);
		// Динамічний: `data-testid="reserve-animal-{animal.id}-btn"`.
		expect(LOCATORS.has('reserve-animal-*-btn'), 'шаблони не зводяться до *').toBe(true);
		// А вигаданого бути не мусить, інакше перевірка пропускає будь-що.
		expect(LOCATORS.has('header-thema-btn'), 'перевірка приймає вигадані локатори').toBe(false);
	});

	it('названий data-testid є в коді', () => {
		const missing = checks.filter((check) => check.testid).filter((c) => !LOCATORS.has(c.testid!));
		expect(
			missing.map((check) => `${check.id} → ${check.testid}`),
			'пункт просить натиснути елемент, якого в коді вже немає'
		).toEqual([]);
	});

	/**
	 * Пункт, що просить НАТИСНУТИ, мусить назвати локатор.
	 *
	 * Це найдорожчий інваріант у файлі, і він з'явився після справжнього випадку.
	 * Пункт «натисніть кнопку зміни теми чотири рази підряд — кольори мусять пройти
	 * чотири набори» описував логіку, якої не було вже 46 комітів: тему давно
	 * вибирають зі списку. Побачив це користувач.
	 *
	 * Причина, чому цього не побачив жоден інваріант, важливіша за сам пункт: поле
	 * `testid` було НЕОБОВʼЯЗКОВЕ. Я пошукав локатор, не знайшов (він складений із
	 * двох файлів), прибрав поле — і пункт став неперевірним за побудовою.
	 * Перевірка мовчала не тому, що помилилася, а тому, що її позбавили входу.
	 *
	 * Тепер вхід забрати не можна: якщо в тексті є «Натисніть», локатор
	 * обовʼязковий. Пункт, який просить натиснути те, чого не можна назвати, —
	 * пункт про інтерфейс, якого автор не читав.
	 */
	it('пункт, що просить натиснути, називає локатор', () => {
		const naked = checks
			.filter((check) => /Натисн|натисн/.test(check.text.uk))
			.filter((check) => !check.testid)
			.map((check) => `${check.id}: ${check.text.uk.slice(0, 60)}…`);
		expect(
			naked,
			`«Натисніть» без локатора — пункт неперевірний за побудовою:\n${naked.join('\n')}`
		).toEqual([]);
	});

	it('тексти й категорії заповнені двома мовами', () => {
		const empty = checks.filter(
			(check) =>
				!check.text.uk.trim() ||
				!check.text.en.trim() ||
				!check.category.uk.trim() ||
				!check.category.en.trim()
		);
		expect(empty, `порожній текст або категорія: ${withId(empty)}`).toEqual([]);
	});

	/**
	 * Кирилиця в англійському тексті означає забутий переклад — скопіювали
	 * український рядок і не переписали. Тип цього не бачить: обидва поля рядкові.
	 */
	it('англійський текст без кирилиці, український — з нею', () => {
		/*
		 * Єдиний виняток, і він по суті: пункт про шрифт мусить НАЗВАТИ літери «і»,
		 * «ї», «є», «ґ» — і в англійському тексті теж, бо шукати їх треба саме в
		 * українських словах. Прибрати їх звідти означало б зробити пункт
		 * невиконуваним. Виняток названий поіменно, а не послаблений виразом: у
		 * будь-якому іншому пункті кирилиця в англійському полі — забутий переклад.
		 */
		const QUOTES_CYRILLIC_LETTERS = new Set(['common_5']);
		const notTranslated = checks
			.filter((check) => !QUOTES_CYRILLIC_LETTERS.has(check.id))
			.filter((check) => /\p{Script=Cyrillic}/u.test(check.text.en));
		expect(notTranslated, `кирилиця в англійському тексті: ${withId(notTranslated)}`).toEqual([]);

		const notUkrainian = checks.filter((check) => !/\p{Script=Cyrillic}/u.test(check.text.uk));
		expect(notUkrainian, `український текст без кирилиці: ${withId(notUkrainian)}`).toEqual([]);
	});

	/**
	 * Вкладка, у якій усе покрито машиною, марнує час людини: вона прийшла
	 * дивитися саме те, чого автотест не вміє.
	 */
	it('у кожної вкладки є пункт, якого машина не перевірить', () => {
		const allMachine = BETA_TABS.filter(
			(tab) => !tab.checks.some((check) => check.coverage === 'manual')
		).map((tab) => tab.id);
		expect(allMachine, `вкладки без жодного manual: ${allMachine.join(', ')}`).toEqual([]);
	});

	/**
	 * Перевірка МЕЖІ в кожній вкладці.
	 *
	 * Правило з чеклиста сусіднього проєкту, і воно варте перенесення дослівно:
	 * найдорожчі дефекти тихі. Ліміт, який перестав діяти, виглядає точно так
	 * само, як ліміт, що діє, — тому «не мусить» треба питати окремо, інакше
	 * ніхто ніколи цього не натисне.
	 */
	it('у кожної вкладки є перевірка межі', () => {
		const without = BETA_TABS.filter((tab) => !tab.checks.some((check) => check.negative)).map(
			(tab) => tab.id
		);
		expect(without, `вкладки без жодного пункта «не мусить»: ${without.join(', ')}`).toEqual([]);
	});

	/**
	 * Номер малює сторінка — з позиції. Номер, вписаний у текст, розійдеться з
	 * позицією на першому ж вставленому пункті, і саме через це в сусідньому
	 * проєкті знадобилося правило «номер у тексті мусить збігатися з позицією».
	 * Тут розходитися нема чому: числа в тексті просто немає.
	 */
	it('текст не починається з номера', () => {
		const numbered = checks.filter((check) => /^\d+[.)]/.test(check.text.uk.trim()));
		expect(numbered, `номер усередині тексту: ${withId(numbered)}`).toEqual([]);
	});

	/**
	 * Текст пункта — для гравця, не для розробника.
	 *
	 * Людина, яка згодилася потикати сайт, не знає ні назв файлів, ні того, що
	 * таке локатор. Пункт із такими словами вона або пропустить, або зрозуміє
	 * навпаки.
	 */
	it('у тексті немає внутрішніх назв', () => {
		const FORBIDDEN = [
			'.ts',
			'.svelte',
			'data-testid',
			'localStorage',
			'Firebase',
			'RTDB',
			'JSON',
			'$state',
			'API'
		];
		const guilty: string[] = [];
		for (const check of checks) {
			for (const word of FORBIDDEN) {
				if (check.text.uk.includes(word) || check.text.en.includes(word)) {
					guilty.push(`${check.id}: «${word}»`);
				}
			}
		}
		expect(guilty, `внутрішні назви в тексті для гравця:\n${guilty.join('\n')}`).toEqual([]);
	});

	/**
	 * Апостроф — лише «ʼ» (U+02BC), як у решті проєкту.
	 *
	 * Наша версія правила «жодних подвійних лапок» із чеклиста сусідів. Там
	 * екранована лапка робила пункт НЕВИДИМИМ, бо файли розбирає регулярний
	 * вираз. Тут пункт не зникне, але два різні апострофи в одному чеклисті
	 * ламають пошук по ньому — а шукати в ньому доводиться щоразу, коли треба
	 * знайти пункт за словом зі звіту.
	 */
	it('в українському тексті лише один вид апострофа', () => {
		const straight = checks.filter(
			(check) => check.text.uk.includes("'") || check.category.uk.includes("'")
		);
		expect(straight, `прямий апостроф замість «ʼ»: ${withId(straight)}`).toEqual([]);
	});

	/**
	 * Текст пункта проходить через `formatFont` — і це доводиться ТУТ, окремо.
	 *
	 * Загальний інваріант `src/i18n-font.test.ts` цього місця не бачить: він шукає
	 * виклики `t()` у розмітці, а текст чеклиста приходить не зі словника, а з
	 * даних. Без обгортки кирилична «і» доїде до сторінки як є, шрифт `inglobal`
	 * її не має — і браузер намалює одну літеру чужим шрифтом посеред слова.
	 * Тобто в чеклисті, який просить придивитися саме до цих літер, вони й були б
	 * зламані.
	 */
	it('сторінка малює текст пункта через formatFont', () => {
		const row = readFileSync('src/lib/components/beta/BetaCheckRow.svelte', 'utf8');
		const body = row.slice(row.indexOf('</script>')).replace(/<style[\s\S]*<\/style>/, '');
		const naked = [...body.matchAll(/\{[^{}]*\b(text|category)\b[^{}]*\}/g)]
			.map((match) => match[0])
			.filter((expression) => !expression.includes('formatFont'));
		expect(naked, `текст пункта без formatFont: ${naked.join(' ')}`).toEqual([]);
	});

	it('порядок показу: спершу те, чого машина не вміє', () => {
		for (const tab of BETA_TABS) {
			const order = sortedChecks(tab).map((check) => check.coverage);
			const manualLast = order.lastIndexOf('manual');
			const coveredFirst = order.indexOf('covered');
			if (manualLast !== -1 && coveredFirst !== -1) {
				expect(manualLast, `${tab.id}: покритий пункт стоїть вище за manual`).toBeLessThan(
					coveredFirst
				);
			}
		}
	});

	/**
	 * Сортування не мусить перемішувати пункти всередині рівня: вони стоять
	 * тематично, і розділи розсипалися б.
	 */
	it('сортування зберігає порядок оголошення всередині рівня', () => {
		for (const tab of BETA_TABS) {
			const sorted = sortedChecks(tab);
			for (const coverage of ['manual', 'testable', 'covered'] as const) {
				const declared = tab.checks.filter((c) => c.coverage === coverage).map((c) => c.id);
				const shown = sorted.filter((c) => c.coverage === coverage).map((c) => c.id);
				expect(shown, `${tab.id}/${coverage}: порядок змінився`).toEqual(declared);
			}
		}
	});
});
