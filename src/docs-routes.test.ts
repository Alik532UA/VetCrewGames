// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HIDDEN_ROUTES, LANGUAGES, LANGUAGE_ROUTES } from '$lib/i18n/routing';

/**
 * `README.md` — перший файл, який читає людина, і він казав неправду про
 * головне.
 *
 * `PIT-DOC-FACTS` (AI-AGENT-PITFALLS-v9 § 5.5.2) вимагає, щоб не лише числа, а
 * й шляхи та переліки мов у документації звірялися двобічним резолвером із тим
 * самим джерелом, яким користується код. Для `PROJECT-CONTEXT.md` це зроблено
 * (`src/project-context.test.ts`, блок «Звірені факти»), а `README.md` не бачив
 * жоден гейт — і ось у якому він був стані на 2026-09-11:
 *
 *   «Дві мови інтерфейсу (`uk`, `en`)» — мов чотири з 2026-08-16;
 *   таблиця ігор — шість маршрутів із дванадцяти: не було ні вікторини
 *     (`/quiz/`, `/quiz/play/`, `/quiz/online/`), ні спільної «Знайди пару»
 *     (`/pairs/`, `/pairs/online/`), ні заповідника з чотирма біомами;
 *   «паритет ключів uk ↔ en» — знову дві мови;
 *   посилання на канон вело у `v8`, тобто на попередню версію стандарту, хоч
 *     решту документів на `v9` перевели комітом `ec2afc9`.
 *
 * Тобто найпомітніший документ проєкту описував приблизно половину його —
 * і виглядав при цьому цілком доглянутим.
 *
 * Звіряються дві речі, обидві від `routing.ts`: перелік мов і перелік
 * маршрутів в індексі. Прихований маршрут при цьому НЕ мусить бути описаний —
 * те саме рішення, що `noindex` і відсутність у sitemap.
 *
 * Проза не звіряється навмисно: перевірка, що чіпляється за формулювання,
 * червоніє від переписаного речення (та сама межа, що в `project-context.test.ts`).
 */

const README = 'README.md';
const text = readFileSync(README, 'utf8');

const indexedRoutes = (Object.keys(LANGUAGE_ROUTES) as (keyof typeof LANGUAGE_ROUTES)[]).filter(
	(rest) => rest !== '' && !HIDDEN_ROUTES.includes(rest)
);

describe(`факти ${README} проти routing.ts (PIT-DOC-FACTS)`, () => {
	it('перевірка жива: файл і джерело маршрутів знайдено', () => {
		expect(text.length, `${README} порожній або не знайдений`).toBeGreaterThan(1000);
		expect(indexedRoutes.length, 'у LANGUAGE_ROUTES не знайдено маршрутів').toBeGreaterThan(5);
		expect(LANGUAGES.length, 'у routing.ts не знайдено мов').toBeGreaterThan(1);
	});

	it('названа кожна мова', () => {
		/*
		 * Мова шукається як \`код\` у зворотних лапках: так вона стоїть у README, і
		 * так вона не збігається випадково з двома літерами всередині слова.
		 *
		 * Саме цей бік звірки й ловить дефект, з якого перевірка почалася:
		 * «Дві мови інтерфейсу (`uk`, `en`)» при чотирьох оголошених дає
		 * «не названі: de, nl».
		 */
		const mentioned = [...text.matchAll(/`([a-z]{2})`/g)].map((m) => m[1]);
		const missing = LANGUAGES.filter((lang) => !mentioned.includes(lang));
		expect(missing, `мова є на сайті й не названа в README: ${missing.join(', ')}`).toEqual([]);
	});

	it('кожен мовний префікс адреси названий, і жоден лишній', () => {
		/*
		 * Зворотний бік звірки — по ПРЕФІКСАХ АДРЕС, а не по кодах у лапках, і це
		 * не дрібниця. Перший підхід шукав будь-який дволітерний \`код\` і в обидва
		 * боки — перший же прогін дав хибне «README називає мову, якої немає: id»,
		 * бо в тексті стоїть «імена файлів страв збігаються з їхніми \`id\`».
		 * Тобто перевірка червоніла на правильному документі.
		 *
		 * Префікс \`/xx/\` таких збігів не дає, і саме він важить для читача:
		 * прострочений префікс — це посилання, яке веде в нікуди.
		 */
		const prefixed = LANGUAGES.filter((lang) => lang !== 'uk');
		const missing = prefixed.filter((lang) => !text.includes(`/${lang}/`));
		expect(
			missing,
			`мова живе в адресі, а README про її префікс не каже: ${missing.join(', ')}`
		).toEqual([]);

		const mentionedPrefixes = [...text.matchAll(/`\/([a-z]{2})\/`/g)].map((m) => m[1]);
		const extra = [...new Set(mentionedPrefixes)].filter(
			(code) => !(LANGUAGES as readonly string[]).includes(code)
		);
		expect(extra, `README посилає на префікс, якого в проєкті немає: ${extra.join(', ')}`).toEqual(
			[]
		);
	});

	it('описаний кожен маршрут в індексі', () => {
		// Збіг за адресою з обома слешами: `/quiz/` не мусить зійти за `/quiz/play/`.
		const missing = indexedRoutes.filter((rest) => !text.includes(`\`/${rest}/\``));
		expect(missing, `маршрути є на сайті й не описані в README: ${missing.join(', ')}`).toEqual([]);
	});

	it('прихованого маршруту в README немає', () => {
		const leaked = HIDDEN_ROUTES.filter((rest) => text.includes(`\`/${rest}/\``));
		expect(leaked, `службова сторінка в README: ${leaked.join(', ')}`).toEqual([]);
	});

	it('посилання на канон ведуть на чинну редакцію, а не на попередню', () => {
		/*
		 * Комміт `ec2afc9` перевів документи з `v8` на `v9` і README пропустив.
		 * Посилання на попередню версію стандарту гірше за відсутнє: воно
		 * відкривається, виглядає правильним і веде не туди (той самий висновок —
		 * у врізці на початку AGENTS.md).
		 */
		const stale = [...text.matchAll(/selection_criteria\/(v\d+)\//g)].map((m) => m[1]);
		const wrong = [...new Set(stale)].filter((v) => v !== 'v9');
		expect(wrong, `README посилається на канон ${wrong.join(', ')} замість v9`).toEqual([]);
	});
});
