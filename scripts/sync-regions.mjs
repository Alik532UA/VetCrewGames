#!/usr/bin/env node
/**
 * Регіон кожної країни — у `src/lib/config/regions.generated.ts`.
 *
 * ## Чому таблиця, а не `Intl`
 *
 * Заміряно, а не припущено. `Intl.DisplayNames` **називає** макрорегіон
 * (`of('150')` → «Європа», і так у всіх чотирьох мовах), але не каже, ЩО в
 * ньому лежить: вкладеності територій (CLDR `territoryContainment`) у
 * `Intl` немає жодним викликом — ні через `supportedValuesOf` (він знає
 * `calendar`, `collation`, `currency`, `numberingSystem`, `timeZone`, `unit`
 * і не знає `region`), ні через `Intl.Locale`. Отже вибір стояв між пакетом
 * CLDR у залежностях і власною таблицею; таблиця важить нуль байтів у
 * рантаймі й нічого не ламає при `npm install`.
 *
 * ## Чому таблиця тут, а не в `src/`
 *
 * Той самий довід, що у `sync-flags.mjs`: у `src/` лежить ПОХІДНЕ, а в
 * скрипті — джерело разом із перевіркою. Перевірка тут головна: вона звіряє
 * таблицю з фактичним набором прапорів і падає, назвавши код, якому регіону
 * не дісталося. Без неї файл тихо старів би після кожного `npm run
 * sync:flags` — а прапори в цьому проєкті додають і прибирають руками.
 *
 * Ту саму повноту перевіряє й `src/lib/config/regions.test.ts` — тобто
 * розходження ловить `npm test`, навіть якщо цей скрипт не перезапускали.
 *
 * ## Звідки взято склад регіонів
 *
 * UN M.49 (той самий стандарт, з якого CLDR будує свої `territoryContainment`),
 * зведений із підрегіонів до СЕМИ груп. Підрегіонів у M.49 двадцять два, і
 * список із двадцяти двох заголовків на 262 пункти читався б гірше за жоден:
 * «Мікронезійський регіон» на трьох країнах — це заголовок, який коштує
 * більше, ніж економить.
 *
 * ЩО ЦЕ КОШТУЄ, названо прямо: M.49 кладе Кіпр, Туреччину, Грузію, Вірменію й
 * Азербайджан у Західну Азію, а не в Європу. Тобто той, хто шукає Кіпр очима,
 * знайде його під «Азією». Це прийнято свідомо: альтернатива — власна
 * політична межа Європи, тобто рішення, яке треба захищати щоразу, коли на
 * нього подивляться. Пошук набором літер у самому вибірнику робить це
 * питання дешевим: «кіп» знаходить Кіпр, у якому б регіоні він не лежав.
 *
 * ВІДХІД ВІД M.49 ОДИН, і він теж названий: приполярні території (`aq`, `bv`,
 * `gs`, `hm`, `tf`) зібрані в окрему групу. M.49 розкидає їх по Європі та
 * Східній Африці — Буве до Норвегії, Французькі південні території до
 * Східної Африки, — і в списку країн це виглядає як помилка, а не як
 * стандарт. Спільного в них рівно те, чим вони й є: безлюдні землі навколо
 * Антарктики.
 *
 * Запуск: `npm run sync:regions`. Результат КОМІТИТЬСЯ — інакше збірка
 * залежала б від того, чи запустили скрипт на цій машині.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FLAGS = join('src', 'lib', 'config', 'countries.generated.ts');
const OUT = join('src', 'lib', 'config', 'regions.generated.ts');

/**
 * СКЛАД РЕГІОНІВ. Ключ — id регіону, значення — коди країн одним рядком.
 *
 * Рядок, а не масив: 262 коди масивом дали б 262 рядки файлу, у яких нічого
 * не видно оком. Одним рядком на підрегіон M.49 видно і склад, і те, що жоден
 * код не стоїть двічі.
 *
 * Коди НЕ з ISO (`xk`, `xr`) і адміністративні одиниці (`es-ct`, `gb-*`,
 * `bq-*`) стоять у групі своєї держави — там їх і шукають.
 */
const REGIONS = {
	europe: [
		// 154 Північна Європа
		'ax dk ee fi fo gb gg ie im is je lt lv no se sj',
		// адміністративні одиниці Великої Британії — з нею ж
		'gb-eng gb-nir gb-sct gb-wls',
		// 155 Західна Європа
		'at be ch de fr li lu mc nl',
		// 039 Південна Європа
		'ad al ba es gi gr hr it me mk mt pt rs si sm va xk es-ct',
		// 151 Східна Європа
		'bg by cz hu md pl ro sk ua',
		// `eu` — не країна, а Європейський Союз; прапор у наборі є, і місце йому тут
		'eu',
		// `xr` — Російський добровольчий корпус; росіяни, тобто Східна Європа M.49
		'xr'
	],
	asia: [
		// 143 Центральна Азія
		'kg kz tj tm uz',
		// 030 Східна Азія
		'cn hk jp kp kr mn mo tw',
		// 035 Південно-Східна Азія
		'bn id kh la mm my ph sg th tl vn',
		// 034 Південна Азія
		'af bd bt in ir lk mv np pk',
		// 145 Західна Азія — саме тут M.49 тримає Кіпр, Туреччину й Кавказ
		'ae am az bh cy ge il iq jo kw lb om ps qa sa sy tr ye'
	],
	africa: [
		// 015 Північна Африка
		'dz eg ly ma sd tn eh ic',
		// 011 Західна Африка
		'bf bj ci cv gh gm gn gw lr ml mr ne ng sh sl sn tg ac ta',
		// 017 Центральна Африка
		'ao cd cf cg cm ga gq st td',
		// 014 Східна Африка
		'bi dj er et io ke km mg mu mw mz re rw sc so ss tz ug yt zm zw',
		// 018 Південна Африка
		'bw ls na sz za'
	],
	'north-america': [
		// 021 Північна Америка
		'bm ca gl pm us um',
		// 013 Центральна Америка
		'bz cr gt hn mx ni pa sv',
		// 029 Кариби
		'ag ai aw bb bl bq bs cu cw dm do gd gp ht jm kn ky lc mf mq ms pr sx tc tt vc vg vi',
		// острови Карибських Нідерландів окремими прапорами
		'bq-bo bq-sa bq-se'
	],
	// 005 Південна Америка
	'south-america': ['ar bo br cl co ec fk gf gy pe py sr uy ve'],
	oceania: [
		// 053 Австралія й Нова Зеландія
		'au cc cx nf nz',
		// 054 Меланезія
		'fj nc pg sb vu',
		// 057 Мікронезія
		'fm gu ki mh mp nr pw',
		// 061 Полінезія
		'as ck nu pf pn tk to tv wf ws'
	],
	// Відхід від M.49, причина — у докблоці файлу
	antarctic: ['aq bv gs hm tf']
};

/** Порядок у файлі й у вибірнику. Рухати його можна лише разом із `regions.ts`. */
const ORDER = [
	'europe',
	'asia',
	'africa',
	'north-america',
	'south-america',
	'oceania',
	'antarctic'
];

const flagsSource = readFileSync(FLAGS, 'utf8');
const flags = [...flagsSource.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
if (flags.length < 100) {
	console.error(`sync-regions: у ${FLAGS} знайдено лише ${flags.length} кодів — перевірити формат`);
	process.exit(1);
}

if (Object.keys(REGIONS).sort().join() !== [...ORDER].sort().join()) {
	console.error('sync-regions: ORDER і REGIONS описують різні набори регіонів');
	process.exit(1);
}

/** Код → регіон, і заразом перевірка, що жоден код не названий двічі. */
const byCode = new Map();
const twice = [];
for (const region of ORDER) {
	for (const chunk of REGIONS[region]) {
		for (const code of chunk.split(/\s+/).filter(Boolean)) {
			if (byCode.has(code)) twice.push(`${code} (${byCode.get(code)} і ${region})`);
			byCode.set(code, region);
		}
	}
}

if (twice.length > 0) {
	console.error(`sync-regions: код у двох регіонах: ${twice.join(', ')}`);
	process.exit(1);
}

/*
 * ДВІ ПЕРЕВІРКИ, а не одна, бо розходження буває в обидві сторони.
 *
 * Прапор без регіону вивалився б із вибірника МОВЧКИ — країна є, а в жодній
 * групі її немає. Регіон без прапора — навпаки, обіцянка про код, якого в
 * наборі вже немає: така таблиця з часом стає списком того, що колись було.
 */
const known = new Set(flags);
const missing = flags.filter((code) => !byCode.has(code));
const stale = [...byCode.keys()].filter((code) => !known.has(code));

if (missing.length > 0) {
	console.error(
		`sync-regions: ${missing.length} прапорів без регіону: ${missing.join(', ')}\n` +
			'Дописати код у потрібний підрегіон REGIONS — вибірник інакше їх не покаже.'
	);
	process.exit(1);
}

if (stale.length > 0) {
	console.error(
		`sync-regions: ${stale.length} кодів у таблиці, яких немає у прапорах: ${stale.join(', ')}\n` +
			'Прибрати з REGIONS: прапор виключили в sync-flags.mjs або пакет його перейменував.'
	);
	process.exit(1);
}

const counts = ORDER.map(
	(region) => `${region} ${flags.filter((code) => byCode.get(code) === region).length}`
).join(', ');

const generated = `/**
 * ГЕНЕРОВАНО \`npm run sync:regions\` — не правити руками.
 *
 * Регіон кожної країни з \`FLAG_COUNTRIES\`. Джерело складу й причини вибору
 * саме такого поділу — \`scripts/sync-regions.mjs\`; назви регіонів тут навмисно
 * немає, вони приходять зі словника (\`config/regions.ts\`).
 *
 * Повноту звіряють двоє: сам скрипт при генерації і \`config/regions.test.ts\`
 * при \`npm test\` — тобто прапор без регіону не доживе до сторінки.
 */
export type RegionId =
${ORDER.map((r) => `\t| '${r}'`).join('\n')};

/** Порядок регіонів у вибірнику. */
export const REGION_ORDER: readonly RegionId[] = [
${ORDER.map((r) => `\t'${r}'`).join(',\n')}
];

/** Код країни → регіон. Кодів ${flags.length}: ${counts}. */
export const COUNTRY_REGION: Readonly<Record<string, RegionId>> = {
${flags
	// Лапки лише там, де без них не можна (`bq-bo`): рівно так це переписав би
	// `prettier --write`, тож `npm run format` на згенерованому файлі — не-дія.
	.map((code) => `\t${/^[a-z]+$/.test(code) ? code : `'${code}'`}: '${byCode.get(code)}'`)
	.join(',\n')}
};
`;

writeFileSync(OUT, generated);

console.log(`sync-regions: ${flags.length} країн у ${ORDER.length} регіонах (${counts}) → ${OUT}`);
