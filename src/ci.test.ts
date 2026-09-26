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
		expect(
			files.length,
			'у .github/workflows немає жодного yml — перевіряти нема що'
		).toBeGreaterThan(0);
	});
});

describe('CI', () => {
	it('тести запускаються в CI (§ 1.6)', () => {
		expect(/run:\s*npm (test|run test)/.test(all), 'у workflow немає кроку з тестами').toBe(true);
	});

	it('використовується npm ci, а не npm install', () => {
		expect(/run:\s*npm install\b/.test(all), 'npm install робить білд невідтворюваним').toBe(false);
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

	/**
	 * ГРУПА — ОКРЕМА ДЛЯ ПОДІЇ Й ГІЛКИ (шостий аудит). У групі GitHub тримає один прогін,
	 * що йде, і один, що чекає, і новий очікуваний скасовує попередній незалежно від
	 * `cancel-in-progress`. Спільна з PR група давала PR змогу скасувати очікуваний
	 * прогін main. Зворотний експеримент: повернути `group: pages` — червоніє.
	 */
	it('PR не скасовує очікуваного прогону main', () => {
		expect(directives).toMatch(
			/group:\s*\$\{\{ github\.workflow \}\}-\$\{\{ github\.event_name \}\}-\$\{\{ github\.ref \}\}/
		);
	});

	it('деплой не скасовує прогону, що вже йде (§ 1.3)', () => {
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
 * ## Три класи кроків (ревізія 9.5 канону)
 *
 * Раніше тут було два класи, і другий формулювався як бланкетне виключення:
 * усе, що залежить від `build/` або від браузерів, умови не отримувало зовсім.
 * Причина була слушна — запускати такий крок після впалої збірки означає не
 * звіт, а шум, — але наслідок неправильний: під цим виключенням ті самі гейти
 * мовчали й тоді, коли збірка ціла, а впав, скажімо, лінтер. Прохід по
 * дев'ятьох проєктах 2026-09-16 показав, що так зробили сім із них.
 *
 *   НЕЗАЛЕЖНИЙ ГЕЙТ ....... `!cancelled()`
 *     типи, lint, юніт-тести, аудит, валідація вмісту, паритет мов — і E2E:
 *     Playwright піднімає ВЛАСНИЙ preview, а не читає теку для деплою.
 *
 *   ПІСЛЯЗБІРКОВИЙ ГЕЙТ ... `!cancelled() && steps.<build>.outcome == 'success'`
 *     `check:build`, `check:bundle`, `git diff --exit-code`, Lighthouse.
 *     Дає звіт щоразу, коли є що міряти, і мовчить лише тоді, коли нема.
 *
 *   ПОБІЧНИЙ ЕФЕКТ ........ умови немає
 *     `build`, `deploy`, `upload-pages-artifact`. Деплой після впалого гейта —
 *     це і є те, від чого гейт захищає.
 *
 * Гейт визначається за КОМАНДОЮ, а не за назвою кроку: назви в проєктах різні
 * («Lint» / «Linting», «Unit Tests» / «Run unit tests»), команди однакові.
 *
 * Перший гейт у job `if` не потребує: до нього ще ніщо не падало.
 */
const INDEPENDENT_GATE =
	/npm run check(?![:\w])|npm run check:(worker|i18n)\b|npm run lint(?![:\w])|npm (run )?test(?!:(e2e|watch))(:\w+)?(?!\S)|npm run audit:ci\b|npm run test:e2e\b|npx playwright test|npm run validate-content\b/;
/** Виглядає гейтом, але залежить від збірки чи браузерів. */
/**
 * Гейти, яким потрібна ЗІБРАНА тека, — третій клас із ревізії 9.5 канону.
 *
 * Раніше цей перелік був ширший (сюди входили Playwright і `check:rules`), і
 * кроки з нього виводилися з-під правила зовсім. Прохід по дев'ятьох проєктах
 * 2026-09-16 показав, чим це коштувало: під бланкетним виключенням вони мовчать
 * і тоді, коли збірка ціла, а впав, скажімо, лінтер. Тепер вони не виключені, а
 * мають ВЛАСНУ умову — `steps.<build>.outcome == 'success'` (§ 1.8).
 *
 * Playwright звідси прибрано свідомо: він піднімає власний `preview`, а не
 * читає теку для деплою, тобто це незалежний гейт. Під старим прочитанням його
 * забирав будь-який попередній червоний крок — включно з `npm audit`.
 */
const BUILD_DEPENDENT = /check:build|check:bundle|git diff --exit-code|lhci/;

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
		//
		// І крок закінчується там, де відступ МЕНШИЙ за його власний: наступний
		// джоб чи коментар до нього кроку вже не належать. Доти тіло тягнулося до
		// наступного `- ` на тому самому відступі — тобто крізь межу джоба, — і
		// коментар над джобом `e2e`, що згадує `check:build`, робив крок
		// `Upload Artifacts` сусіднього джоба «післязбірковим гейтом без умови».
		const dedented = (line: string) =>
			line.trim() !== '' && line.length - line.trimStart().length < indent.length;
		while (
			j < lines.length &&
			!new RegExp(`^${indent}- `).test(lines[j]) &&
			!new RegExp(`^${indent}#`).test(lines[j]) &&
			!dedented(lines[j])
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

	/**
	 * Післязбіркові гейти: `!cancelled() && steps.<build>.outcome == 'success'`
	 * (CI-CD-AND-TOOLS-v9 § 1.8, третій клас).
	 *
	 * Голе `!cancelled()` тут було б гірше за відсутність умови: крок побіг би й
	 * після впалої збірки й дав вторинне падіння «теки немає», яке ховає справжню
	 * причину. А без умови взагалі — мовчить і тоді, коли міряти є що.
	 */
	/**
	 * Підготовка гейта успадковує умову гейта (CI-CD-AND-TOOLS-v9 § 1.8, 9.6).
	 *
	 * Заміряно в `Slovko`, прогін 35075608772 — перший після переходу на три
	 * класи. `Unit tests` упав, E2E під новим `!cancelled()` чесно побіг далі, а
	 * `Install Playwright chromium` умови не мав і його пропустили. Замість
	 * одного справжнього дефекту у звіті стало сорок рядків
	 * `browserType.launch: Executable doesn't exist` — тобто стан ГІРШИЙ за той,
	 * що був до послаблення: доти E2E чесно пропускали.
	 */
	it('підготовка E2E несе ту саму умову, що й сам E2E', () => {
		const PREP = /playwright install|ms-playwright/;
		const E2E_STEP = /playwright test|npm run test:e2e/;
		const offenders: string[] = [];

		for (const file of files) {
			const steps = stepsOf(readFileSync(`${DIR}/${file}`, 'utf8'));
			const byJob = new Map<string, typeof steps>();
			for (const step of steps) {
				if (!byJob.has(step.job)) byJob.set(step.job, []);
				byJob.get(step.job)!.push(step);
			}
			for (const [job, jobSteps] of byJob) {
				const gate = jobSteps.find((s) => E2E_STEP.test(s.body) && !PREP.test(s.body));
				if (!gate || !/!cancelled\(\)/.test(gate.body)) continue;
				for (const step of jobSteps) {
					if (!PREP.test(step.body)) continue;
					if (/!cancelled\(\)/.test(step.body)) continue;
					offenders.push(`${file} → ${job} → «${step.name}»`);
				}
			}
		}

		expect(
			offenders,
			`E2E побіжить без браузерів і впаде не на дефекті:\n${offenders.join('\n')}`
		).toEqual([]);
	});

	it('післязбірковий гейт несе умову на результат збірки', () => {
		const afterBuild = files.flatMap((file) =>
			stepsOf(readFileSync(`${DIR}/${file}`, 'utf8'))
				.filter((s) => BUILD_DEPENDENT.test(s.body))
				.map((s) => ({ ...s, file }))
		);
		/*
		 * ПЕРШИЙ ТЕЖ, на відміну від незалежних гейтів вище. Звільнення «до першого
		 * ще ніщо не падало» правдиве лише для першого гейта джоба, а перед першим
		 * післязбірковим завжди стоять незалежні. Доти він був звільнений — і
		 * зворотний експеримент 2026-09-23 це показав: зняли умову з
		 * `Check build output`, прогін лишився зеленим, хоча після впалого лінтера
		 * цей крок тоді тихо пропускається.
		 */
		const offenders: string[] = [];
		for (const gate of afterBuild) {
			if (!/!cancelled\(\)\s*&&\s*steps\.\w+\.outcome\s*==\s*'success'/.test(gate.body)) {
				offenders.push(`${gate.file} → ${gate.job} → «${gate.name}»`);
			}
		}
		expect(offenders, `післязбірковий гейт без умови на збірку:\n${offenders.join('\n')}`).toEqual(
			[]
		);
	});

	it('аудит залежностей лишається строгішим за канон — свідомо', () => {
		/*
		 * ЦЕЙ ПУНКТ СТЕРЕЖЕ РІШЕННЯ ВЛАСНИКА ВІД ЧЕРГОВОГО «ВИПРАВЛЕННЯ ЗА КАНОНОМ».
		 *
		 * `DEPENDENCIES-v8` (`GATE-AUDIT`) радить `npm audit --omit=dev`: у браузер
		 * їде лише прод-дерево. Тут аудит навмисно дивиться й на інструментарій —
		 * вразливий `eslint` чи `vite` виконується на машині розробника з доступом
		 * до всього репозиторію, а ціна заміряна й мала: різниця між двома
		 * командами — одна знахідка `low`.
		 *
		 * Відхилення записане в PROJECT-CONTEXT.md, розділ «Свідомі відхилення». І
		 * запису виявилося МАЛО: 2026-08-26 аудит за пакетом прочитав `GATE-AUDIT`,
		 * не прочитав того рядка й додав прапорець як «розходження з каноном».
		 * Рішення, яке живе лише в документі, скасовується читанням іншого
		 * документа; рішення, яке валить прогін, — ні.
		 *
		 * Якщо власник колись передумає — міняється цей пункт РАЗОМ із рядком у
		 * PROJECT-CONTEXT.md, і саме ця пара змін і є свідомий вибір.
		 *
		 * Реверсний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): додано `--omit=dev`
		 * назад у крок — пункт червоніє.
		 */
		// З ревізії 9.5 канону крок кличе ОБГОРТКУ, а не `npm audit` напряму
		// (CI-CD-AND-TOOLS-v9 § 1.15, `CI-THIRD-PARTY-OUTAGE`): голий крок падає
		// й тоді, коли ліг реєстр npm. Тому поріг і область перевіряються там, де
		// вони тепер живуть — у самому скрипті.
		const audit = gates.filter((g) => /audit:ci/.test(g.body));
		expect(audit.length, 'крок аудиту мусить існувати').toBe(1);

		const wrapper = readFileSync('scripts/check-audit.mjs', 'utf8');
		expect(wrapper, 'поріг high, а не moderate').toMatch(/'high', 'critical'/);
		expect(
			wrapper,
			'`--omit=dev` тут не помилка канону, а записане відхилення — див. PROJECT-CONTEXT.md'
		).not.toMatch(/npm audit --omit=dev --json/);
		expect(wrapper, 'обгортка більше не падає від знахідки').toMatch(/process\.exit\(1\)/);
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

/**
 * `--legacy-peer-deps` у CI (DEPENDENCIES-v8 § 2.4, `DEP-TOOL-ENGINE-CONFLICT`).
 *
 * Прапорець знімає перевірку peer-залежностей для УСЬОГО дерева — тобто гасить
 * сигнал там, де він потрібен, заради одного пакета, який його породив. І
 * головне: він переживає причину. У `MindStep` його додали 2026-03-03 комітом
 * «resolve Vite 7 dependency conflict» і не знімали пів року; на 2026-08-23
 * `npm ci` без прапорця проходить чисто, тобто екосистема наздогнала Vite 7
 * давно, а перевірка peer-залежностей лишалася вимкненою.
 *
 * Правильний спосіб для інструмента, чиї транзитивні `engines` конфліктують із
 * проєктом, — обгортка над `npx` із послабленням РІВНО для дочірнього процесу
 * (`scripts/firebase-cli.mjs`), а не прапорець на весь install.
 *
 * Перевірка тримає нуль: у шести проєктах із семи прапорця не було ніколи, і
 * ратчет на нулі коштує нічого — зате перша ж спроба «швидко полагодити install»
 * стає видимою в прогоні, а не через пів року.
 */
describe('install у CI не глушить перевірку peer-залежностей', () => {
	it('жоден workflow не кличе npm із --legacy-peer-deps', () => {
		const offenders = files.filter((file) =>
			/--legacy-peer-deps/.test(readFileSync(`${DIR}/${file}`, 'utf8'))
		);
		expect(
			offenders,
			'прапорець знімає перевірку peer-залежностей для всього дерева; ' +
				'для інструмента з конфліктом engines є обгортка над npx (DEPENDENCIES-v8 § 2.4):\n' +
				offenders.join('\n')
		).toEqual([]);
	});

	it('перевірка жива: workflow прочитано', () => {
		expect(files.length, 'у .github/workflows немає жодного yml').toBeGreaterThan(0);
	});
});

/**
 * Вивантажується ТА збірка, яку перевіряли (CI-CD-AND-TOOLS-v9 § 1.10,
 * `CI-DEPLOY-ORDER`, HIGH).
 *
 * Дефект живе не в кроці, а в ПОРЯДКУ кроків, і саме тому його не бачить жоден
 * інший гейт: кожен міряє теку `build/`, яка на момент його погляду правильна.
 *
 * Заміряно 2026-08-26 в `adoptananimal`: `playwright.config.ts` піднімав власний
 * сервер командою `npm run build && npm run preview` — у ту саму теку, але без
 * змінних, які має лише крок збірки для деплою. Крок E2E стояв НИЖЧЕ збірки,
 * тож порядок був: правильна збірка → зелений `check:build` над нею → E2E
 * перезаписує `build/` → `upload-pages-artifact` вивантажує саме її. Сайт
 * відкривався, бо пререндер робить шляхи відносними; але `canonical` кожної з
 * 229 сторінок і кожен `<loc>` у sitemap вказували на СУСІДНІЙ сайт спільного
 * домену.
 *
 * Тут порядок сьогодні правильний — E2E стоїть вище збірки, — і перевірка
 * ратчетна: вона стереже, щоб його не переставили. Ціна переставляння тиха:
 * `npm run test:e2e` тут теж робить власну збірку (`webServer` у
 * `playwright.config.ts`), тобто крок, перенесений нижче, перезапише саме те,
 * що вже перевірив `check:build`.
 */
describe('порядок кроків деплою (CI-CD-AND-TOOLS-v9 § 1.10)', () => {
	/** Команди, які САМІ пишуть у `build/`. */
	const WRITES_BUILD = /npm run build\b|npm run test:e2e\b|playwright test\b/;
	/**
	 * Із них — саме збірка для деплою.
	 *
	 * `npm run test:e2e` теж робить збірку: `webServer` у `playwright.config.ts`
	 * кличе `npm run build` у ту саму теку. Тобто у workflow це два різні кроки
	 * з однаковим побічним ефектом, і відрізняти їх треба командою, а не назвою.
	 */
	const DEPLOY_BUILD = /run:\s*npm run build\s*$/m;

	const jobs = files.flatMap((file) => {
		const steps = stepsOf(readFileSync(`${DIR}/${file}`, 'utf8'));
		const names = [...new Set(steps.map((s) => s.job))];
		return names.map((job) => ({ file, job, steps: steps.filter((s) => s.job === job) }));
	});

	/** Job, який вивантажує теку збірки на хостинг. */
	const deploying = jobs.filter((j) => j.steps.some((s) => /upload-pages-artifact/.test(s.body)));

	it('розбір живий: job із вивантаженням артефакту знайдено', () => {
		expect(
			deploying.length,
			'жоден job не кличе upload-pages-artifact — або розбір зламався, ' +
				'або сайт більше не викладається так, і перевірку треба переписати'
		).toBe(1);
	});

	/*
	 * ПИТАННЯ СТАВИТЬСЯ ПРО ОСТАННЬОГО ПИСЬМЕННИКА, а не «чи є щось після
	 * збірки», і цю різницю показав зворотний експеримент.
	 *
	 * Перша редакція брала за збірку для деплою ОСТАННІЙ крок, що пише в
	 * `build/`, і питала, чи є письменники після нього. Відповідь «немає» була
	 * там завжди — за побудовою. Вставлений між `Build` і `Upload` крок
	 * `npm run test:e2e` перевірку не завалив: він САМ ставав «збіркою для
	 * деплою». Інваріант виглядав правильним і не міряв нічого.
	 */
	it('останнє, що пише в build/ перед вивантаженням, — саме збірка для деплою', () => {
		const offenders: string[] = [];
		for (const { file, job, steps } of deploying) {
			const upload = steps.findIndex((s) => /upload-pages-artifact/.test(s.body));
			const writers = steps
				.slice(0, upload)
				.flatMap((s, i) => (WRITES_BUILD.test(s.body) ? [i] : []));
			if (!writers.length) {
				offenders.push(`${file}::${job}: перед вивантаженням немає жодної збірки`);
				continue;
			}

			const last = writers[writers.length - 1];
			if (!DEPLOY_BUILD.test(steps[last].body))
				offenders.push(
					`${file}::${job}: останнє, що пише в build/ перед вивантаженням, — ` +
						`«${steps[last].name}», а не збірка для деплою: поїде не та збірка, яку перевірили`
				);

			/*
			 * Друга половина того самого питання, і саме вона ловить дефект
			 * `adoptananimal` із боку, з якого його побачили: там E2E стояв НИЖЧЕ
			 * `check:build`, тобто перевірка дивилася на теку, яку потім
			 * перезаписали. Порядок мусить бути «збірка → перевірка → вивантаження».
			 */
			const inspect = steps.findIndex((s) => /npm run check:build/.test(s.body));
			if (inspect === -1)
				offenders.push(`${file}::${job}: збірку ніхто не перевіряє перед викладенням`);
			else if (inspect < last)
				offenders.push(
					`${file}::${job}: «${steps[inspect].name}» дивиться на build/ ДО того, як ` +
						`«${steps[last].name}» його перезапише — зелений звіт про іншу збірку`
				);
		}
		expect(offenders, offenders.join('\n')).toEqual([]);
	});
});

/**
 * ДЕПЛОЙ ЧЕКАЄ НА КОЖЕН ДЖОБ, У ЯКОМУ Є ГЕЙТ — прямо чи через ланцюжок `needs`.
 *
 * З 2026-09-23 E2E живе окремим джобом поруч зі збіркою (прохання автора,
 * варіант A): так час до публікації — максимум двох джобів, а не їх сума, і
 * червоний E2E більше не ховає збірку й `check:build`. Ціна поділу — новий спосіб
 * тихо зламатися: джоб, якого немає в `needs` деплою, стає ПОРАДОЮ. Сайт виїжджає,
 * щойно зібрався, а червоний E2E лишається рядком у списку, на який ніхто не
 * дивиться (CI-CD-AND-TOOLS-v9 § 1.18.3). Жоден інший гейт цього не бачить:
 * workflow синтаксично правильний, прогін зелений.
 *
 * Розбір — тими самими рівнями відступу, що `stepsOf`: `needs` стоїть на рівні
 * властивостей джоба.
 */
describe('деплой чекає на кожен гейт (CI-CD-AND-TOOLS-v9 § 1.18)', () => {
	/** Джоб → його `needs` (порожньо, коли залежностей немає). */
	function needsOf(text: string): Map<string, string[]> {
		const graph = new Map<string, string[]>();
		let job: string | null = null;
		for (const line of text.split('\n')) {
			const jobLine = /^ {2}([A-Za-z0-9_.-]+):\s*$/.exec(line);
			if (jobLine) {
				job = jobLine[1];
				graph.set(job, []);
				continue;
			}
			const needsLine = /^ {4}needs:\s*(.+)$/.exec(line);
			if (job && needsLine) {
				graph.set(
					job,
					needsLine[1]
						.replace(/[[\]]/g, '')
						.split(',')
						.map((name) => name.trim())
						.filter(Boolean)
				);
			}
		}
		return graph;
	}

	const GATE = new RegExp(`${INDEPENDENT_GATE.source}|${BUILD_DEPENDENT.source}|check:rules`);

	const deployFiles = files.filter((file) =>
		/actions\/deploy-pages/.test(readFileSync(`${DIR}/${file}`, 'utf8'))
	);

	it('розбір живий: workflow із публікацією знайдено', () => {
		expect(deployFiles.length, 'жодного workflow з `actions/deploy-pages`').toBeGreaterThan(0);
	});

	it('кожен джоб із гейтом стоїть у ланцюжку `needs` публікації', () => {
		const offenders: string[] = [];
		for (const file of deployFiles) {
			const text = readFileSync(`${DIR}/${file}`, 'utf8');
			const graph = needsOf(text);
			const steps = stepsOf(text);
			const publisher = steps.find((s) => /actions\/deploy-pages/.test(s.body))?.job;
			expect(publisher, `${file}: крок публікації не знайдено розбором`).toBeTruthy();

			const awaited = new Set<string>();
			const queue = [...(graph.get(publisher!) ?? [])];
			while (queue.length > 0) {
				const next = queue.pop()!;
				if (awaited.has(next)) continue;
				awaited.add(next);
				queue.push(...(graph.get(next) ?? []));
			}

			const gated = new Set(steps.filter((s) => GATE.test(s.body)).map((s) => s.job));
			expect(gated.size, `${file}: жодного джоба з гейтом — розбір зламався`).toBeGreaterThan(0);
			for (const job of gated) {
				if (job !== publisher && !awaited.has(job)) offenders.push(`${file} → ${job}`);
			}
		}
		expect(
			offenders,
			`публікація не чекає на ці джоби — їхні гейти стали порадою:\n${offenders.join('\n')}`
		).toEqual([]);
	});
	/**
	 * ПРАВИЛА БАЗИ ВИЇЖДЖАЮТЬ ЛИШЕ РАЗОМ ІЗ САЙТОМ (аудит 2026-09-24).
	 *
	 * Доти `rules_deploy` чекав лише на емулятор: червоні збірка чи E2E зупиняли
	 * сайт, а правила однаково їхали — і нові правила жили зі СТАРИМ сайтом, хоч
	 * бувають із ним несумісні (склад мапою замість масиву, поля ходу лише відомі).
	 * Тож робота, що викладає правила, мусить чекати на все, на що чекає публікація
	 * сайту, — крім себе самої.
	 *
	 * Зворотний експеримент: повернути `needs: rules` — червоніє.
	 */
	it('робота, що викладає правила, чекає на ті самі гейти, що й сайт', () => {
		const offenders: string[] = [];
		for (const file of deployFiles) {
			const text = readFileSync(`${DIR}/${file}`, 'utf8');
			const graph = needsOf(text);
			const steps = stepsOf(text);
			const awaitedBy = (job: string) => {
				const seen = new Set<string>();
				const queue = [...(graph.get(job) ?? [])];
				while (queue.length > 0) {
					const next = queue.pop()!;
					if (seen.has(next)) continue;
					seen.add(next);
					queue.push(...(graph.get(next) ?? []));
				}
				return seen;
			};
			const site = steps.find((s) => /actions\/deploy-pages/.test(s.body))?.job;
			const rules = steps.find((s) => /rules:deploy/.test(s.body))?.job;
			expect(
				site && rules,
				`${file}: публікацію сайту чи правил не знайдено розбором`
			).toBeTruthy();

			const forRules = awaitedBy(rules!);
			for (const job of awaitedBy(site!)) {
				if (job !== rules && !forRules.has(job))
					offenders.push(`${file}: ${rules} не чекає ${job}`);
			}
		}
		expect(
			offenders,
			`правила виїдуть без сайту, якщо ці гейти червоні:\n${offenders.join('\n')}`
		).toEqual([]);
	});
});

/**
 * Мажор дії не каже, на якому Node вона працює (CI-CD-AND-TOOLS-v9 § 1.9,
 * `CI-ACTION-RUNTIME`, MEDIUM).
 *
 * Номер релізу про рантайм не каже НІЧОГО: заміряно 2026-08-23 у восьми
 * репозиторіях — `upload-artifact@v5` і `configure-pages@v5` стоять на `node20`,
 * тобто очевидне «підняти на v5» попередження про застарілий рантайм не зняло б
 * узагалі. Дізнатися правду можна лише в самої дії:
 *
 *     gh api repos/actions/upload-artifact/contents/action.yml --jq '.content' \
 *       | base64 -d | grep "using:"
 *
 * Перевірка НЕ ходить у мережу — вона тримає перелік мажорів, які вже читали
 * очима, і падає на кожному, якого в переліку немає. Тобто вона не доводить, що
 * рантайм свіжий; вона робить інше й потрібніше: не дає підняти мажор БЕЗ
 * звірки. У проєкті щотижневі Dependabot-PR, зокрема на дії, — саме такий PR і
 * пройшов би тихо.
 *
 * Переліку не місце в PROJECT-CONTEXT.md: він читається кодом, а не людиною.
 */
describe('рантайм кожної дії звірений, а не припущений (CI-CD-AND-TOOLS-v9 § 1.9)', () => {
	/**
	 * `дія@мажор` → рантайм із `runs.using` в `action.yml` цього мажора.
	 *
	 * Звірено 2026-09-10 разом із аудитом за каноном v9 — і звірено НА ТЕГУ
	 * МАЖОРА, а не на типовій гілці: `?ref=v6` замість запиту без `ref`.
	 * Різниця не формальна — типова гілка показує стан НАЙНОВІШОГО мажора, тож
	 * запит без `ref` відповідав би на питання, якого ніхто не ставив, і
	 * `cache@v6` виглядав би так само, як `cache@v7`.
	 *
	 * Рядок додається ЛИШЕ після того, як рантайм прочитано в дії; інакше
	 * перелік перетворюється на дозвільний список, який нічого не звіряє.
	 */
	const VERIFIED: Record<string, string> = {
		'actions/checkout@v7': 'node24',
		'actions/setup-node@v7': 'node24',
		'actions/cache@v6': 'node24',
		'actions/upload-artifact@v7': 'node24',
		'actions/setup-java@v5': 'node24',
		'actions/deploy-pages@v5': 'node24',
		/*
		 * `composite` — і це не «немає рантайму», а «рантайм чужий».
		 *
		 * Composite-дія Node не запускає сама; попередження про застарілий
		 * рантайм дає дія ВСЕРЕДИНІ неї, тобто вказує на те, чого у workflow
		 * немає. Прочитано разом із рештою: `upload-pages-artifact@v5` тягне
		 * `actions/upload-artifact@…` з коментарем `# v7.0.0`, а той на `node24`.
		 * Тобто ланцюжок чистий — але звірявся він у ДВА кроки, а не в один.
		 */
		'actions/upload-pages-artifact@v5': 'composite → upload-artifact v7 (node24)'
	};

	const used = [
		...new Set(
			[...directives.matchAll(/^\s*(?:- )?uses:\s*([^\s@]+)@(v\d+)/gm)].map(
				(m) => `${m[1]}@${m[2]}`
			)
		)
	].sort();

	it('розбір живий: дії у workflow знайдено', () => {
		expect(used.length, 'жодної `uses:` — або розбір зламався, або дій немає').toBeGreaterThan(3);
	});

	it('кожна дія у workflow має звірений рантайм', () => {
		const unknown = used.filter((action) => !(action in VERIFIED));
		expect(
			unknown,
			'мажор не звірений. Прочитати рантайм У САМОЇ ДІЇ й додати рядок у VERIFIED:\n' +
				unknown
					.map(
						(a) =>
							`  ${a} → gh api repos/${a.split('@')[0]}/contents/action.yml ` +
							`--jq '.content' | base64 -d | grep "using:"`
					)
					.join('\n')
		).toEqual([]);
	});

	it('у переліку немає дій, яких у workflow вже немає', () => {
		// Дзеркало: прострочений рядок так само неправдивий, як відсутній —
		// просто мовчазний (AI-AGENT-PITFALLS-v9 § 5.5).
		const stale = Object.keys(VERIFIED).filter((a) => !used.includes(a));
		expect(stale, `дію прибрано з workflow — прибрати й рядок:\n${stale.join('\n')}`).toEqual([]);
	});
});
