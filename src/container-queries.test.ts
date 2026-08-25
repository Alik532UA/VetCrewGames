// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ШИРИНА МІРЯЄТЬСЯ ВІД МІСЦЯ, А НЕ ВІД ЕКРАНА (FLUID-SIZING-v8, FS-CONTAINER).
 *
 * ## Що це за клас дефектів
 *
 * `@media (min-width: 1000px)` у компоненті питає про ЕКРАН. Але компонент рідко
 * займає весь екран: він лежить у стовпці, у вікні, у панелі — і саме ширина
 * того місця вирішує, чи вміститься ряд із дев'яти зон. Той самий компонент на
 * широкому екрані всередині вузького вікна отримує розкладку «як на десктопі» і
 * ламається — а медіазапит при цьому каже правду про екран.
 *
 * Це не теорія: у цьому проєкті вікно перевірки в заповіднику показує дошку
 * «Де живем?», і на 26rem її підписи налазили один на одного, поки екран був
 * 1200px завширшки. Полагоджено розширенням вікна, але правило лишилося
 * непокритим — і наступна дошка в наступному вікні впаде так само.
 *
 * ## Чому облік, а не заборона
 *
 * Перевести дев'ять компонентів на `@container` одним рухом означало б змінити
 * розкладку кожної гри без нагоди подивитися на кожну очима. Тому тут — той
 * самий взірець, що в `eslint-baseline.test.ts` і в списку завеликих файлів:
 * борг названий числом, число лише СПАДАЄ, і кожен новий ширинний медіазапит у
 * компоненті валить прогін.
 *
 * ## Що НЕ рахується боргом
 *
 * `@media (hover: hover)`, `(pointer: fine)`, `print`, `prefers-reduced-motion` —
 * це можливості пристрою, а не місце. Контейнерний запит на них не відповідає
 * взагалі, і вимагати його там було б помилкою в інший бік.
 *
 * Маршрути (`src/routes/`) теж поза межею: сторінка справді займає екран, і
 * питати про екран у неї законно.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): додати
 * `@media (min-width: 900px)` у будь-який компонент зі списку — червоніє
 * «борг не зростає»; прибрати рядок зі списку, лишивши запит у файлі, — червоніє
 * «список актуальний». Обидва зроблені.
 */

function componentFiles(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) componentFiles(full, out);
		else if (entry.endsWith('.svelte')) out.push(full.split(String.fromCharCode(92)).join('/'));
	}
	return out;
}

/** Запит про МІСЦЕ: ширина або висота. Решта ознак — про пристрій, не про місце. */
const SIZE_QUERY = /@media[^{]*\((min|max)-(width|height)\s*:/g;

/**
 * Скільки ширинних медіазапитів лишилося в кожному компоненті.
 *
 * Число — саме кількість запитів, а не «є/немає»: компонент, який перевели
 * наполовину, мусить бути видним як наполовину переведений.
 *
 * Погашений рядок прибирається зі списку — його стереже третя перевірка.
 */
const MEDIA_DEBT: Record<string, number> = {
	'src/lib/components/FeedingBoard.svelte': 2,
	'src/lib/components/FeedingZone.svelte': 1,
	'src/lib/components/GameHeader.svelte': 1,
	'src/lib/components/HabitatBoard.svelte': 1,
	'src/lib/components/HabitatOptions.svelte': 2,
	'src/lib/components/HabitatRound.svelte': 1,
	'src/lib/components/pairs/OnlineGate.svelte': 1,
	'src/lib/components/PopulationBoard.svelte': 1,
	'src/lib/components/quiz/QuizBoard.svelte': 2
};

describe('розмір від місця, а не від екрана (FLUID-SIZING § FS-CONTAINER)', () => {
	const files = componentFiles('src/lib/components');
	/**
	 * КОМЕНТАРІ ВИКИДАЮТЬСЯ ПЕРЕД ПІДРАХУНКОМ.
	 *
	 * Перша редакція рахувала текст файлу як є — і `PopulationBoard` дав два
	 * запити замість одного: другий стояв у докблоці, який ПОЯСНЮЄ, що той
	 * медіазапит прибрано. Тобто борг ріс від опису його погашення.
	 */
	const counted = files.map((file) => ({
		file,
		queries: (
			readFileSync(file, 'utf8')
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/<!--[\s\S]*?-->/g, '')
				.match(SIZE_QUERY) ?? []
		).length
	}));

	it('перевірка жива: компоненти знайдено й борг не порожній', () => {
		expect(files.length).toBeGreaterThan(20);
		expect(Object.keys(MEDIA_DEBT).length).toBeGreaterThan(0);
	});

	it('нового ширинного медіазапиту в компонентах немає', () => {
		const unexpected = counted
			.filter(({ file, queries }) => queries > 0 && !(file in MEDIA_DEBT))
			.map(({ file, queries }) => `${file}: ${queries} — питає про екран, а не про своє місце`);
		expect(unexpected, `новий запит про екран у компоненті:\n${unexpected.join('\n')}`).toEqual([]);
	});

	it('борг лише спадає', () => {
		const grown = counted
			.filter(({ file, queries }) => file in MEDIA_DEBT && queries > MEDIA_DEBT[file])
			.map(({ file, queries }) => `${file}: ${queries} > ${MEDIA_DEBT[file]}`);
		expect(grown, `борг зростає, а мав лише спадати:\n${grown.join('\n')}`).toEqual([]);
	});

	/**
	 * Прострочений рядок — така сама проблема, як його відсутність: він приховає
	 * наступний запит у тому самому файлі.
	 */
	it('у списку немає файлів, які вже перевели', () => {
		const stale = counted
			.filter(({ file, queries }) => file in MEDIA_DEBT && queries < MEDIA_DEBT[file])
			.map(({ file, queries }) => `${file}: ${queries} — число в списку завелике`);
		const missing = Object.keys(MEDIA_DEBT).filter(
			(file) => !counted.some((entry) => entry.file === file)
		);
		expect([...stale, ...missing], 'список розійшовся з кодом — оновити MEDIA_DEBT').toEqual([]);
	});
});
