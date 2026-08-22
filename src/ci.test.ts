import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * CI-CD-AND-TOOLS-v8 § 3 — workflow теж код, і його стан перевіряється.
 *
 * Пайплайн живе поза межами всіх інших гейтів: `svelte-check` його не читає,
 * ESLint не читає, тести не читають. Помилка в ньому виявляється або на
 * наступному push (у кращому разі), або взагалі ніколи — коли крок мовчки
 * перестає щось перевіряти, а зелена галочка лишається.
 */
const DIR = '.github/workflows';

const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f)) : [];
const all = files.map((f) => readFileSync(`${DIR}/${f}`, 'utf8')).join('\n');

/**
 * Те саме без коментарів. Пояснення у workflow цитують значення, які тут-таки
 * перевіряються, — і перевірка по сирому тексту знаходить власну документацію
 * замість дійсності.
 */
const directives = all.replace(/(^|\s)#.*$/gm, '');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
	scripts?: Record<string, string>;
	engines?: Record<string, string>;
};
const scripts = pkg.scripts ?? {};

/** Мажор із будь-якої форми запису: `22`, `>=22.12.0`, `22.12`. */
const major = (value: string | undefined) => value?.match(/(\d+)/)?.[1] ?? null;

describe('перевірка жива', () => {
	it('workflow знайдено', () => {
		expect(files.length, 'у .github/workflows немає жодного yml — перевіряти нема що').toBeGreaterThan(0);
	});
});

describe('CI', () => {
	it('тести запускаються в CI (§ 1.6)', () => {
		expect(/run:\s*npm (test|run test)/.test(all), 'у workflow немає кроку з тестами').toBe(true);
	});

	it('використовується npm ci, а не npm install', () => {
		expect(/run:\s*npm install\b/.test(all), 'npm install робить білд невідтворюваним').toBe(
			false
		);
	});

	it('Playwright має крок встановлення браузерів (§ 1.3)', () => {
		if (!/playwright test/.test(all)) return;
		expect(/playwright install/.test(all), 'без install крок падає на відсутньому браузері').toBe(
			true
		);
	});

	it('жоден тестовий скрипт не у watch-режимі (§ 1.4)', () => {
		// Не лише `test`: гейтом у workflow буває `test:unit`, `test:report`,
		// `test:ci` — і саме там watch і зустрічається, бо `test` перевіряють, а
		// решту ні. `test:watch` виключений навмисно: він для цього й існує.
		const watchers = Object.entries(scripts)
			.filter(([name]) => /^test(:|$)/.test(name) && name !== 'test:watch')
			.filter(([, cmd]) => /^vitest\s*$/.test(cmd));
		expect(watchers, 'watch-режим підвисне поза CI, де немає CI=true').toEqual([]);
	});

	/**
	 * Пункт поза шаблоном пакета — знайдений у цих проєктах.
	 *
	 * Workflow кличе npm-скрипти за іменем. Перейменування скрипта в
	 * `package.json` не ламає нічого локально й нічого не ламає на збірці: воно
	 * ламає рівно той крок CI, який на нього посилався, і виявляється це вже
	 * після push. Тут це видно до коміту.
	 */
	/**
	 * DEPENDENCIES-v8 § 2.3: версія Node у workflow збігається з `engines.node`
	 * і з `.nvmrc`. Розбіжність не ламає нічого одразу — вона означає, що
	 * продакшн збирається на іншому рантаймі, ніж той, на якому це перевіряли,
	 * і виявляється це вже після push.
	 */
	it('версія Node однакова у workflow, engines і .nvmrc (§ 1.2)', () => {
		const workflow = major(/node-version:\s*'?([\d.]+)'?/.exec(all)?.[1]);
		const engines = major(pkg.engines?.node);
		const nvmrc = existsSync('.nvmrc') ? major(readFileSync('.nvmrc', 'utf8').trim()) : null;

		expect(workflow, 'у workflow не знайдено node-version').not.toBeNull();
		expect(engines, 'engines.node не оголошено в package.json').not.toBeNull();
		expect({ workflow, engines, nvmrc }).toEqual({
			workflow,
			engines: workflow,
			nvmrc: nvmrc === null ? null : workflow
		});
	});

	it('деплой не скасовує проміжні прогони (§ 1.3)', () => {
		// `cancel-in-progress: true` разом із пушем пачкою комітів дає прогін,
		// якого не було: щойно доданий гейт не виконується жодного разу, а в
		// переліку кроків це виглядає як «не дійшло» (AI-AGENT-PITFALLS-v8 § 1.4).
		//
		// Коментарі відрізаються ПЕРЕД пошуком, і це не педантизм: у самому
		// workflow значення процитоване в поясненні, тому перевірка по сирому
		// тексту лишалася зеленою і при `true`. Знайдено зворотним експериментом
		// (§ 1.1) — тест мовчав саме там, де мав червоніти.
		expect(directives, 'блоку concurrency немає взагалі').toMatch(/concurrency:/);
		expect(directives).toMatch(/cancel-in-progress:\s*false/);
		expect(directives, 'скасування проміжних прогонів увімкнене').not.toMatch(
			/cancel-in-progress:\s*true/
		);
	});

	/**
	 * Зворотний бік перевірки нижче, і саме він тут двічі був потрібен.
	 *
	 * «Кожен скрипт із workflow існує» ловить перейменування. Протилежного воно
	 * НЕ ловить: гейт лежить у `package.json`, його ніхто не кличе, і зелена
	 * галочка CI означає рівно те, що виконали решту. У цьому проєкті так уже
	 * було двічі — `npm run lint` існував і в CI не викликався, а `GATE-DEPS`
	 * існував лише в `canon.json`. Обидва рази дефект виглядав як «гейт є»
	 * (AI-AGENT-PITFALLS-v8 § 3: файл є, отже працює).
	 *
	 * Перелічувати нічого не треба: гейти тут звуться `check*`, тож перелік
	 * виводиться зі самого `package.json` і росте разом із ним. Виняток один і
	 * за ІМЕНЕМ, а не за виглядом команди: `:watch` — інструмент розробника, і
	 * та сама умова стоїть у сусідній перевірці для `test:watch`.
	 */
	it('кожен гейт `check*` із package.json викликається в CI', () => {
		const gates = Object.keys(scripts).filter(
			(name) => /^check(:|$)/.test(name) && !name.endsWith(':watch')
		);
		expect(
			gates.length,
			'у package.json немає жодного скрипта `check*` — перевіряти нема що'
		).toBeGreaterThan(0);

		// Коментарі відрізані: пояснення у workflow цитують назви гейтів, і
		// перевірка по сирому тексту знаходила б власну документацію замість
		// виклику.
		const called = new Set([...directives.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]));
		const uncalled = gates.filter((name) => !called.has(name));
		expect(
			uncalled,
			`гейт є в package.json і не викликається в CI — зелений прогін про нього нічого не каже: ${uncalled.join(', ')}`
		).toEqual([]);
	});

	it('кожен npm-скрипт із workflow існує в package.json', () => {
		const referenced = [...all.matchAll(/run:\s*npm run ([\w:-]+)/g)].map((m) => m[1]);
		const missing = [...new Set(referenced)].filter((name) => !(name in scripts));
		expect(
			missing,
			`workflow кличе скрипт, якого немає — крок упаде на push: ${missing.join(', ')}`
		).toEqual([]);
	});
});

/**
 * Впала перевірка не забирає звіт у решти (CI-CD-AND-TOOLS-v8 § 1.8).
 *
 * ## Що саме ловить ця перевірка
 *
 * GitHub за замовчуванням НЕ запускає кроки після впалого. Job із рядка
 * `check → lint → test → audit` при червоному `lint` дає один рядок у звіті —
 * і про тести з аудитом відомо не «зелені» й не «червоні», а НІЧОГО.
 *
 * Це не гіпотеза. У `teatralo4ka` крок `Lint` падав на 26 помилках, і `gh run
 * list` показував `failure` на шести послідовних пушах; три наступні гейти
 * (`Unit tests`, `Audit`, `Validate content`) за ці дві доби не виконалися ані
 * разу. Червоне при цьому стало звичним фоном — тобто гірше за зелену галочку
 * без прогону, бо виглядає як чесне падіння.
 *
 * ## Межа правила
 *
 * Під нього підпадають лише НЕЗАЛЕЖНІ СТАТИЧНІ гейти — ті, яким потрібні самі
 * `node_modules`: типи, lint, юніт-тести, аудит, валідація вмісту, паритет мов.
 * Кроки з побічним ефектом (`build`, `deploy`, `upload-pages-artifact`) і кроки,
 * що залежать від `build/` або від браузерів (`check:build`, `check:bundle`,
 * Playwright, Lighthouse), `!cancelled()` НЕ отримують: запускати їх після
 * впалої збірки означає не звіт, а шум.
 *
 * Гейт визначається за КОМАНДОЮ, а не за назвою кроку: назви в проєктах різні
 * («Lint» / «Linting», «Unit Tests» / «Run unit tests»), команди однакові.
 *
 * Перший гейт у job `if` не потребує: до нього ще ніщо не падало.
 */
const INDEPENDENT_GATE =
	/npm run check(?![:\w])|npm run check:(worker|i18n)\b|npm run lint(?![:\w])|npm (run )?test(?!:(e2e|watch))(:\w+)?(?!\S)|npm audit\b|npm run validate-content\b/;
/** Виглядає гейтом, але залежить від збірки чи браузерів. */
const BUILD_DEPENDENT = /check:build|check:bundle|check:rules|playwright|lhci|npm run build/;

/**
 * Кроки одного workflow у порядку появи, з розбиттям на job.
 *
 * Розбір регуляркою, а не YAML-парсером: `js-yaml` є не в кожному проєкті, а
 * додавати залежність заради однієї перевірки дорожче за розбір рівнів відступу.
 * Ціна — перевірка «розбір живий» нижче, без якої порожній результат читався б
 * як «порушень немає».
 */
function stepsOf(text: string): { job: string; name: string; body: string }[] {
	const steps: { job: string; name: string; body: string }[] = [];
	const lines = text.split('\n');
	let job = '(поза job)';
	for (let i = 0; i < lines.length; i++) {
		const jobLine = /^ {2}([A-Za-z0-9_.-]+):\s*$/.exec(lines[i]);
		if (jobLine) {
			job = jobLine[1];
			continue;
		}
		const stepLine = /^(\s+)- name: (.*)$/.exec(lines[i]);
		if (!stepLine) continue;
		const [, indent, name] = stepLine;
		let j = i + 1;
		// Коментар на рівні кроку належить НАСТУПНОМУ кроку: інакше рядок
		// «# playwright install без кешу…» приліплюється до `Audit dependencies`
		// і виключає його як залежний від браузерів.
		while (
			j < lines.length &&
			!new RegExp(`^${indent}- `).test(lines[j]) &&
			!new RegExp(`^${indent}#`).test(lines[j])
		) {
			j++;
		}
		steps.push({ job, name: name.trim(), body: lines.slice(i, j).join('\n') });
	}
	return steps;
}

describe('гейти не ховають один одного (CI-CD-AND-TOOLS-v8 § 1.8)', () => {
	// Свій перелік файлів, а не спільний `all`: назва файлу потрібна в тексті
	// помилки, а склеєний вміст її втрачає.
	const gates = files.flatMap((file) =>
		stepsOf(readFileSync(`${DIR}/${file}`, 'utf8'))
			.filter((s) => INDEPENDENT_GATE.test(s.body) && !BUILD_DEPENDENT.test(s.body))
			.map((s) => ({ ...s, file }))
	);

	it('розбір живий: незалежні статичні гейти знайдено', () => {
		expect(
			gates.length,
			'у workflow не знайдено жодного кроку з `npm run check/lint/test/audit` — ' +
				'або розбір зламався, або гейтів справді немає; обидва випадки червоні'
		).toBeGreaterThan(0);
	});

	it('кожен гейт після першого в job несе `if: !cancelled()`', () => {
		const seen = new Set<string>();
		const offenders: string[] = [];
		for (const gate of gates) {
			const key = `${gate.file}::${gate.job}`;
			const isFirst = !seen.has(key);
			seen.add(key);
			if (isFirst) continue;
			if (!/!cancelled\(\)/.test(gate.body)) {
				offenders.push(`${gate.file} → ${gate.job} → «${gate.name}»`);
			}
		}
		expect(
			offenders,
			`перший червоний гейт забере звіт у цих кроків:\n${offenders.join('\n')}`
		).toEqual([]);
	});

	it('`continue-on-error` не стоїть на гейтах', () => {
		// `continue-on-error: true` — не альтернатива `!cancelled()`, а
		// протилежність: job зеленіє при червоному гейті. Це рівно те, що § 1.6
		// забороняє.
		const lax = gates
			.filter((g) => /continue-on-error:\s*true/.test(g.body))
			.map((g) => `${g.file} → «${g.name}»`);
		expect(lax, `гейт, який не валить job:\n${lax.join('\n')}`).toEqual([]);
	});
});
