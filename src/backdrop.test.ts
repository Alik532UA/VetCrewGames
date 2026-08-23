import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Кожен текст лежить на підкладці — своїй або предковій.
 *
 * Тло застосунку — фотографія з довільними світлими й темними ділянками. Текст
 * просто на ній читається як пощастить: «Роздай страви тваринам» і «Де ця
 * тварина живе в дикій природі» місяцями стояли без фону, і побачив це
 * користувач, а не гейт. Ані `svelte-check`, ані eslint такого не бачать: з
 * погляду коду `<p class="prompt">` із самим лише `color` бездоганний.
 *
 * Перевірка НЕ рахує кольори в браузері — вона читає джерела. Тому питання, на
 * яке вона відповідає, вужче й перевіряється надійно: чи має цей текст у СВОЄМУ
 * файлі хоч одного предка з фоном. Підкладка з іншого компонента сюди не
 * видна — для цього є `BACKED_BY_PARENT`.
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
 * Компоненти, які самі фону не мають, бо їх завжди кладуть на чужий — так само,
 * як `.myth-card__statement` лежить на `.myth-card`. Кожен рядок — обіцянка, що
 * компонент не вставляють просто на сторінку.
 */
const BACKED_BY_PARENT: Record<string, string> = {
	'src/lib/components/RoundIndicator.svelte': 'лічильник раундів — усередині шапки гри',
	'src/lib/components/FeedingVerdicts.svelte': 'кожен присуд має власну картку .verdict',
	'src/lib/components/GameOverCard.svelte': 'уся розмітка лежить у картці .game-over-card',
	// Перелік кімнат малюється ЛИШЕ як четвертий блок форми входу, всередині
	// `.gate`, і фон дає вона (`--color-bg-panel`). Власний фон тут був би
	// панеллю на панелі — двома шарами того самого кольору з видимим швом.
	'src/lib/components/pairs/RoomList.svelte': 'п’ятий блок форми входу, фон дає .gate__panel',
	// Перемикач стану — примітив із `ui/`, і кладуть його ЛИШЕ всередину панелі.
	// Спільна смуга сегментів свій фон має; підпис групи (`legend`) — ні, і саме
	// його бачить ця перевірка. Власний фон під підписом був би панеллю на панелі.
	'src/lib/components/ui/SegmentedChoice.svelte': 'примітив вибору, фон дає панель-господар',
	// Позначка «це ви» стоїть ВСЕРЕДИНІ імені гравця, а імена живуть на трьох
	// панелях: склад лобі (`.lobby__list.text-panel`), табло партії
	// (`.board__score.text-panel`) і рядок переможця (`.board__over.text-panel`).
	// Власний фон тут був би кольоровою плямою посеред рядка тексту.
	'src/lib/components/ui/YouTag.svelte': 'позначка в рядку імені, фон дає панель зі списком',
	// QR має ВЛАСНЕ біле поле (сканеру потрібне саме воно), а підпис під ним лежить
	// на `.lobby__invite.text-panel` у лобі — предку з іншого файлу.
	'src/lib/components/pairs/RoomQr.svelte': 'QR у лобі, фон дає .lobby__invite',
	// Вибір країни — примітив із `ui/`, і кладуть його ЛИШЕ всередину панелі
	// (у формі входу — у блок «хто я»). Поле `<select>` свій фон має; підпис
	// над ним — ні, і саме його бачить ця перевірка.
	'src/lib/components/ui/CountryPicker.svelte': 'вибір країни, фон дає панель-господар',
	// Набір ігор кладуть у панель `.quiz-online__games.text-panel` — і у формі
	// входу, і в лобі. Свій фон тут був би панеллю на панелі.
	'src/lib/components/quiz/QuizGamePicker.svelte': 'набір ігор, фон дає .quiz-online__games',
	'src/lib/components/ErrorFallback.svelte': 'екран помилки — суцільна картка',
	// Панелі заповідника малюються ЛИШЕ всередині `BottomSheet`, і фон дає він.
	// Свій фон тут був би панеллю на панелі — двома шарами того самого кольору
	// з видимим швом на межі.
	'src/lib/components/reserve/AnimalsPanel.svelte': 'вміст висувної панелі, фон дає BottomSheet',
	'src/lib/components/reserve/AcquireTab.svelte': 'вміст висувної панелі, фон дає BottomSheet',
	'src/lib/components/reserve/EnclosurePanel.svelte': 'вміст висувної панелі, фон дає BottomSheet',
	'src/lib/components/reserve/StaffPanel.svelte': 'вміст висувної панелі, фон дає BottomSheet',
	'src/lib/components/reserve/TasksPanel.svelte': 'вміст висувної панелі, фон дає BottomSheet',
	'src/lib/components/reserve/ContractsBlock.svelte': 'вміст висувної панелі, фон дає BottomSheet',
	// Обидві картки вибраного на карті — це ВМІСТ `MapCard`, і фон дає він. У
	// кожній з них `<MapCard>` — корінь розмітки, тож обіцянку видно з першого
	// рядка шаблону, а не з чужого файлу.
	'src/lib/components/reserve/AnimalCard.svelte': 'вміст картки на карті, фон дає MapCard',
	'src/lib/components/reserve/EnclosureCard.svelte': 'вміст картки на карті, фон дає MapCard'
};

/** Глобальний клас підкладки з `lib/styles/global.css`. */
const PANEL_CLASS = 'text-panel';

/** Класи, чиє правило в цьому ж файлі задає непрозорий фон. */
function classesWithBackground(style: string): Set<string> {
	const out = new Set<string>();
	const clean = style.replace(/\/\*[\s\S]*?\*\//g, '');
	for (const [, selector, body] of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const background = body.match(/(^|[\s;])background(-color)?\s*:\s*([^;]+)/)?.[3] ?? '';
		if (!background || /^\s*(none|transparent|inherit|initial)\s*$/.test(background)) continue;
		// `transparent 90%` у color-mix — це майже прозоро, підкладкою не рахуємо.
		const mix = background.match(/transparent\s+(\d+)%/);
		if (mix && Number(mix[1]) > 85) continue;
		for (const [, cls] of selector.matchAll(/\.([a-zA-Z][\w-]*)/g)) out.add(cls);
	}
	return out;
}

const VOID_TAGS = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr'
]);

/**
 * Текст, який справді видно.
 *
 * Службові блоки Svelte не малюють нічого: `{#each}`, `{:else}`, `{/if}` — це
 * керування, `{@const}` і `{@debug}` — оголошення. А от `{@html …}` малює, і
 * саме ним тут виводять майже всі підписи, тож він мусить рахуватися текстом.
 *
 * `{@render …}` — теж НЕ текст, і з'ясувалося це дефектом: `{@render children()}`
 * у кореневому layout вважався голим текстом на `.page-transition-wrapper`.
 * Сніпет малює те, що дала дитина, — так само, як компонент із великої літери,
 * якого перевірка вже пропускає з тією самою причиною: його розмітка живе у
 * власному файлі, там її й перевірять.
 *
 * Доти це не спливало, бо `.app-shell` вважався підкладкою — через правило
 * `[data-fake-fullscreen] .app-shell { background-color: … }`. Тобто перевірка
 * зараховувала УМОВНИЙ фон, який у звичайному стані не діє, як безумовний, і
 * була зелена з неправильної причини.
 */
function isVisibleText(chunk: string): boolean {
	let out = '';
	for (let i = 0; i < chunk.length; i++) {
		const rest = chunk.slice(i);
		const control = rest.match(/^\{(?:[#/:]|@(?:const|debug|render)\b)/);
		if (!control) {
			out += chunk[i];
			continue;
		}
		let depth = 0;
		let j = i;
		for (; j < chunk.length; j++) {
			if (chunk[j] === '{') depth++;
			else if (chunk[j] === '}' && --depth === 0) break;
		}
		i = j;
	}
	return out.replace(/<!--[\s\S]*?-->/g, '').trim().length > 0;
}

interface Naked {
	file: string;
	tag: string;
	classes: string;
	text: string;
}

/**
 * Кінець тега, з урахуванням лапок і фігурних дужок.
 *
 * Регулярний вираз тут не працює: в атрибуті живе `onclick={() => reset()}`, і
 * `>` зі стрілки обриває тег на середині. Через це перша версія перевірки
 * «знайшла» шість неіснуючих проблем.
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

function nakedTexts(file: string, source: string, globalBacked: Set<string>): Naked[] {
	const style = source.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? '';
	const backed = classesWithBackground(style);
	for (const cls of globalBacked) backed.add(cls);
	backed.add(PANEL_CLASS);

	const markup = source
		.slice(source.indexOf('</script>') + 1)
		.replace(/<style[\s\S]*<\/style>/, '')
		.replace(/<!--[\s\S]*?-->/g, '');

	const problems: Naked[] = [];
	const stack: Array<{ tag: string; backed: boolean; classes: string }> = [];
	let cursor = 0;
	let i = 0;

	while (i < markup.length) {
		const lt = markup.indexOf('<', i);
		if (lt === -1) break;
		const head = markup.slice(lt + 1, lt + 40);
		const nameMatch = head.match(/^(\/?)([A-Za-z][\w:.-]*)/);
		if (!nameMatch) {
			i = lt + 1;
			continue;
		}

		const [, closing, tag] = nameMatch;
		const gt = endOfTag(markup, lt + 1);
		const attrs = markup.slice(lt + 1 + nameMatch[0].length, gt);
		const selfClosed = attrs.trimEnd().endsWith('/');

		// Текст належить елементу, всередині якого ми зараз стоїмо.
		const open = stack[stack.length - 1];
		const between = markup.slice(cursor, lt);
		if (open && !open.backed && isVisibleText(between)) {
			problems.push({
				file,
				tag: open.tag,
				classes: open.classes || '(без класу)',
				text: between.replace(/\s+/g, ' ').trim().slice(0, 55)
			});
			// Одного повідомлення на елемент досить — далі не шумимо.
			open.backed = true;
		}
		cursor = gt + 1;
		i = gt + 1;

		if (closing) {
			const at = stack.map((s) => s.tag).lastIndexOf(tag);
			if (at !== -1) stack.length = at;
			continue;
		}
		if (selfClosed || VOID_TAGS.has(tag.toLowerCase())) continue;
		// `<svelte:head>` і подібні не малюють коробки, а компонент (велика
		// літера) тримає свою розмітку у власному файлі — там його й перевірять.
		if (tag.includes(':') || /^[A-Z]/.test(tag)) {
			if (tag === 'svelte:head') {
				const close = markup.indexOf('</svelte:head>', i);
				if (close !== -1) {
					i = close + '</svelte:head>'.length;
					cursor = i;
				}
			}
			continue;
		}

		const classes = attrs.match(/\bclass="([^"]*)"/)?.[1] ?? '';
		const classList = [
			...classes.split(/\s+/),
			...[...attrs.matchAll(/\bclass:([\w-]+)/g)].map((m) => m[1])
		].filter(Boolean);
		const hasBackground = classList.some((cls) => backed.has(cls));
		stack.push({
			tag,
			backed: (open?.backed ?? false) || hasBackground,
			classes: classList.join(' ')
		});
	}
	return problems;
}

describe('текст на підкладці', () => {
	const components = walk('src').filter((f) => f.endsWith('.svelte'));

	it('перевірка жива: компоненти знайдено', () => {
		expect(components.length).toBeGreaterThan(5);
	});

	// Глобальні класи з фоном видні всім компонентам — `.text-panel`, `.skip-link`.
	const globalBacked = classesWithBackground(readFileSync('src/lib/styles/global.css', 'utf8'));

	it('глобальні стилі знайдено', () => {
		expect(globalBacked.has(PANEL_CLASS), 'у global.css немає .text-panel').toBe(true);
	});

	it('кожен текст має фон — свій або предків', () => {
		const problems = components
			.filter((file) => !(file in BACKED_BY_PARENT))
			.flatMap((file) => nakedTexts(file, readFileSync(file, 'utf8'), globalBacked))
			.map((p) => `${p.file}: <${p.tag} class="${p.classes}"> — «${p.text}»`);

		expect(
			problems,
			`текст лежить просто на тлі сторінки. Додати ".${PANEL_CLASS}" йому чи предку:\n${problems.join('\n')}`
		).toEqual([]);
	});

	/**
	 * Фонову ФОТОГРАФІЮ ніхто не гасить і нічим не накриває.
	 *
	 * Додано після дефекту, який знайшов користувач: натиск на кнопку повного
	 * екрана заливав фон однотонним кольором. У запасному режимі повного екрана
	 * `.app-shell` отримував `position: fixed; inset: 0; z-index: 9999` РАЗОМ із
	 * непрозорим `background-color: var(--color-bg)` — тобто коробку на весь
	 * екран поверх фото, яке лежить під сподом (`z-index: -1`). А власні
	 * псевдоелементи `.app-shell` те саме правило гасило `display: none` під
	 * коментарем «вона вже є в body::before/after» — неправдивим: шарів чотири,
	 * по одному на тему, і на `.app-shell` живуть саме `winter` та
	 * `orange-purple`.
	 *
	 * Перевіряються обидві половини дефекту окремо, бо кожна ламає фон сама.
	 *
	 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): повернути в блок
	 * `[data-fake-fullscreen]` рядок `background-color: var(--color-bg)` — перша
	 * перевірка червона; повернути `display: none` на псевдоелементи — друга.
	 */
	/** Файли, у яких живуть шари фону й режим повного екрана. */
	const globalCss: Array<[string, string]> = [
		'src/lib/styles/global.css',
		'src/lib/styles/animations.css'
	].map((file) => [file, readFileSync(file, 'utf8')] as [string, string]);

	const LAYER_SELECTOR = /\.app-shell::(before|after)|body::(before|after)/;

	it('жодне правило не гасить шар фонової фотографії', () => {
		const guilty: string[] = [];
		for (const [file, css] of globalCss) {
			// Правила без вкладення: `селектор { тіло }`.
			for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
				const selector = m[1].trim().replace(/\s+/g, ' ');
				if (!LAYER_SELECTOR.test(selector)) continue;
				if (/display\s*:\s*none/.test(m[2])) {
					guilty.push(`${file}: ${selector} — display: none гасить фото теми`);
				}
			}
		}
		expect(guilty, guilty.join('\n')).toEqual([]);
	});

	it('запасний повний екран не накриває фото непрозорим тлом', () => {
		const guilty: string[] = [];
		for (const [file, css] of globalCss) {
			for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
				const selector = m[1].trim().replace(/\s+/g, ' ');
				if (!selector.includes('data-fake-fullscreen')) continue;
				const body = m[2];
				// Прозоре тло законне; будь-яке інше накриє фото, бо коробка на весь екран.
				const bg = /background(?:-color)?\s*:\s*([^;]+)/.exec(body)?.[1]?.trim();
				if (bg && !/^(transparent|none|rgba\([^)]*,\s*0\s*\))$/.test(bg)) {
					guilty.push(`${file}: ${selector} — тло «${bg}» поверх фотографії теми`);
				}
			}
		}
		expect(guilty, guilty.join('\n')).toEqual([]);
	});

	it('у списку «фон дає батько» немає зайвих файлів', () => {
		// Прострочений виняток мовчки ховає наступний голий текст у тому ж файлі.
		const stale = Object.keys(BACKED_BY_PARENT).filter((file) => !components.includes(file));
		expect(stale, 'файлу вже немає — прибрати з BACKED_BY_PARENT').toEqual([]);
	});
});
