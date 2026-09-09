// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `GATE-SVELTE-SOURCES` — чотири інваріанти по джерелах SVELTE-CORE-v9 в одному
 * файлі, як приписує § 8 того самого документа.
 *
 * Спільне в усіх чотирьох: компілятор про них не каже нічого, `svelte-check`
 * зелений, юніт-тест сервісу зелений — а функції немає або пам'ять тече. Тобто
 * це рівно той клас дефектів, який видно лише інваріантом по тексту.
 *
 *   § 1.6  `SC-SNAPSHOT-BOUNDARY`   HIGH    проксі за межею серіалізації
 *   § 2.2.2 `SC-LISTENER-CLEANUP`   MEDIUM  слухач без парного зняття
 *   § 3.2.1 `SC-SUBSCRIPTION-WIRED` HIGH    підписка, якої ніхто не кличе
 *   § 3.3   аксесор контексту                `getContext` просто в компоненті
 *
 * Кожен пункт починається з канарки «джерела знайдено»: без неї перевірка
 * зелена на порожньому переліку, і саме це найчастіший спосіб отримати гейт,
 * який нічого не стереже (AI-AGENT-PITFALLS-v9 § 1).
 *
 * ЗВОРОТНИЙ ЕКСПЕРИМЕНТ на кожен пункт — у повідомленні коміта, який цей файл
 * приніс. Пункт, який не впав на навмисно поверненому дефекті, не рахується
 * робочим (`PIT-REVERSE-EXPERIMENT`).
 */

const IGNORED_DIRS = new Set(['node_modules', '.svelte-kit', 'build', 'dist']);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (IGNORED_DIRS.has(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(ts|svelte)$/.test(entry)) out.push(full.split('\\').join('/'));
	}
	return out;
}

const isCheck = (f: string) => /\.(test|spec)\.ts$/.test(f);
const all = walk('src');
const sources = all.filter((f) => !isCheck(f));

const cache = new Map<string, string>();
const read = (f: string) => {
	const cached = cache.get(f);
	if (cached !== undefined) return cached;
	const text = readFileSync(f, 'utf8');
	cache.set(f, text);
	return text;
};

/** Текст без коментарів: інакше згадка в докблоці читається як код. */
const stripComments = (text: string) =>
	text
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1')
		.replace(/<!--[\s\S]*?-->/g, '');

const code = new Map<string, string>();
const codeOf = (f: string) => {
	const cached = code.get(f);
	if (cached !== undefined) return cached;
	const text = stripComments(read(f));
	code.set(f, text);
	return text;
};

// ─── § 1.6 Межа серіалізації ────────────────────────────────────────────────

/**
 * Проксі `$state` не перетинає межу серіалізації без `$state.snapshot`.
 *
 * `structuredClone` на проксі кидає `DataCloneError` — це видно одразу.
 * Небезпечніші два тихі випадки: `JSON.stringify` серіалізує проксі, але
 * ВТРАЧАЄ вкладені `Map`/`Set`, а сторонній SDK отримує обʼєкт, який під ним
 * далі змінюється.
 *
 * Чому це важливо саме тут: заповідник тримає все дерево партії в `$state` і
 * пише його в `localStorage` кожним ходом. Сьогодні між станом і сховищем стоїть
 * `serialize()` з `reserve/save.ts`, який збирає плоский обʼєкт полем за полем, —
 * і саме тому знахідок немає. Ця перевірка стереже той день, коли хтось
 * скоротить шлях і віддасть у `setJSON` сам стан.
 */
const SERIALIZERS = ['JSON.stringify', 'structuredClone', 'postMessage', 'setJSON'];

// ─── § 2.2.2 Парне зняття слухача ───────────────────────────────────────────

const LISTENER_RE = /addEventListener\s*\(|\.observe\s*\(|setInterval\s*\(/;
/**
 * Що вважається зняттям — включно з двома механізмами, які канон називає
 * винятками: `once: true` і `AbortSignal` (§ 2.2.1). Обидва знімають слухача
 * без окремого виклику, тож вимагати `removeEventListener` там означало б
 * вимагати гіршого коду.
 */
const CLEANUP_RE =
	/removeEventListener\s*\(|\.disconnect\s*\(|\.unobserve\s*\(|clearInterval\s*\(|once:\s*true|signal:\s*/;

// ─── § 3.2.1 Підключена підписка ────────────────────────────────────────────

/** Сервісний шар: те, що САМЕ реалізує підписки, а не споживає їх. */
const SERVICE_LAYER = /^src\/lib\/(net|services)\//;

/** Імена, які канон називає ознакою підписки. */
const SUBSCRIPTION_NAME =
	/^(subscribe[A-Za-z0-9]*|init|start[A-Za-z0-9]*|listen[A-Za-z0-9]*|watch[A-Za-z0-9]*)$/;

type Declared = { file: string; name: string };

/**
 * Оголошені в сервісному шарі підписки: `export function`, `export const` і
 * метод класу першого рівня вкладеності.
 */
function declaredSubscriptions(): Declared[] {
	const out: Declared[] = [];
	for (const file of sources.filter((f) => SERVICE_LAYER.test(f))) {
		for (const m of codeOf(file).matchAll(
			/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(|export\s+(?:const|let)\s+([A-Za-z0-9_]+)\s*[:=]|^\t(?:async\s+)?([a-z][A-Za-z0-9_]*)\s*\(/gm
		)) {
			const name = m[1] ?? m[2] ?? m[3];
			if (name && SUBSCRIPTION_NAME.test(name)) out.push({ file, name });
		}
	}
	return out;
}

/**
 * Файли, у яких ім'я справді ВИКЛИКАЮТЬ (`name(`), а не згадують.
 *
 * Різниця не теоретична: у `MindStep` перша редакція цієї перевірки лишалася
 * зеленою після того, як лобі повернули до одноразового читання, — назву методу
 * згадував коментар поруч, і цього виявилося достатньо.
 */
const callersOf = (name: string) =>
	sources.filter((f) => new RegExp(`\\b${name}\\s*\\(`).test(codeOf(f)));

/**
 * Підписка підключена, якщо до неї є шлях ІЗЗОВНІ сервісного шару.
 *
 * Шлях може бути через сусідній сервіс, і це законно: `+layout.svelte` кличе
 * `startPlaySync()`, а той усередині кличе `watchPlay()`. Вимагати прямого
 * виклику з компонента означало б вимагати, щоб макет знав про транспорт.
 *
 * Тому обхід транзитивний: назва підключена, коли її кличе файл поза сервісним
 * шаром, або коли її кличе сервісний файл, у якому підключена хоч одна власна
 * назва-підписка. Рекурсія з пам'яттю — цикл «A кличе B, B кличе A» дає
 * «не підключено» для обох, і це правильна відповідь.
 */
function wired(declared: Declared[]): Map<string, boolean> {
	const byFile = new Map<string, string[]>();
	for (const d of declared) byFile.set(d.file, [...(byFile.get(d.file) ?? []), d.name]);

	const answer = new Map<string, boolean>();
	const visiting = new Set<string>();

	const solve = (name: string): boolean => {
		const known = answer.get(name);
		if (known !== undefined) return known;
		if (visiting.has(name)) return false; // цикл: доведення немає
		visiting.add(name);

		let result = false;
		for (const caller of callersOf(name)) {
			if (!SERVICE_LAYER.test(caller)) {
				result = true;
				break;
			}
			// Виклик із сусіднього сервісу рахується лише тоді, коли САМ цей сервіс
			// хтось кличе іззовні.
			const ownNames = (byFile.get(caller) ?? []).filter((n) => n !== name);
			if (ownNames.some(solve)) {
				result = true;
				break;
			}
		}

		visiting.delete(name);
		answer.set(name, result);
		return result;
	};

	for (const d of declared) solve(d.name);
	return answer;
}

describe('SVELTE-CORE: інваріанти по джерелах (§ 8)', () => {
	it('перевірка жива: джерела знайдено', () => {
		expect(sources.length, 'джерел немає — усі чотири пункти нижче безпредметні').toBeGreaterThan(
			100
		);
	});

	describe('§ 1.6 межа серіалізації (SC-SNAPSHOT-BOUNDARY)', () => {
		/** Файли з рунами — лише вони можуть віддати проксі за межу. */
		const runeFiles = sources.filter(
			(f) => (f.endsWith('.svelte') || f.endsWith('.svelte.ts')) && /\$state[({<]/.test(codeOf(f))
		);

		it('перевірка жива: файли з $state і виклики серіалізації знайдено', () => {
			expect(runeFiles.length, 'файлів із $state не знайдено').toBeGreaterThan(5);
			const anySerializer = sources.some((f) => SERIALIZERS.some((s) => codeOf(f).includes(s)));
			expect(anySerializer, 'жодного виклику серіалізації — перевірка мертва').toBe(true);
		});

		it('проксі $state не переходить межу без $state.snapshot', () => {
			const findings: string[] = [];
			for (const file of runeFiles) {
				const text = codeOf(file);
				// Що в цьому файлі оголошено через $state: `x = $state(...)` та
				// `let x = $state(...)`, зокрема поля класу без `let`.
				const stateNames = new Set(
					[
						...text.matchAll(
							/(?:^|[\s;])(?:let\s+|const\s+)?([A-Za-z_$][\w$]*)\s*=\s*\$state[({<]/g
						)
					].map((m) => m[1])
				);
				if (!stateNames.size) continue;

				for (const line of text.split(/\r?\n/)) {
					if (!SERIALIZERS.some((s) => line.includes(`${s}(`))) continue;
					if (line.includes('$state.snapshot')) continue;
					for (const name of stateNames) {
						// Аргументом стоїть саме ця змінна або її поле/метод:
						// `stringify(state)`, `setJSON(k, this.logs.slice(…))`.
						const arg = new RegExp(
							`(?:${SERIALIZERS.map((s) => s.replace('.', '\\.')).join('|')})\\([^)]*\\b(?:this\\.)?${name}\\b`
						);
						if (arg.test(line)) findings.push(`${file}: ${line.trim().slice(0, 120)}`);
					}
				}
			}
			expect(
				findings,
				`проксі $state їде в серіалізатор без $state.snapshot:\n${findings.join('\n')}`
			).toEqual([]);
		});
	});

	describe('§ 2.2.2 парне зняття слухача (SC-LISTENER-CLEANUP)', () => {
		const withListener = sources.filter((f) => LISTENER_RE.test(codeOf(f)));

		it('перевірка жива: файли зі слухачами знайдено', () => {
			expect(withListener.length, 'жодного addEventListener/observe/setInterval').toBeGreaterThan(
				5
			);
		});

		it('кожен файл зі слухачем містить і зняття', () => {
			/*
			 * Евристика ФАЙЛОВА, і це навмисно: вона не доводить, що знято
			 * правильний слухач, — вона ловить файл, у якому про зняття не думали
			 * взагалі. Витік на SPA-навігації не видно нічим: сторінка працює, тест
			 * зелений, а через двадцять переходів на `window` висить двадцять
			 * обробників `resize`, і кожен тримає свій компонент у пам'яті.
			 */
			const leaking = withListener.filter((f) => !CLEANUP_RE.test(codeOf(f)));
			expect(leaking, `слухач без парного зняття в тому ж модулі:\n${leaking.join('\n')}`).toEqual(
				[]
			);
		});
	});

	describe('§ 3.2.1 підключена підписка (SC-SUBSCRIPTION-WIRED)', () => {
		const declared = declaredSubscriptions();
		const answer = wired(declared);

		it('перевірка жива: підписки в сервісному шарі знайдено', () => {
			expect(declared.length, 'у net/ і services/ немає жодної підписки').toBeGreaterThan(5);
		});

		it('до кожної підписки є шлях іззовні сервісного шару', () => {
			const orphans = declared
				.filter((d) => !answer.get(d.name))
				.map((d) => `${d.file}: ${d.name}()`);
			/*
			 * Знахідка закривається одним із двох: викликом там, де функція справді
			 * потрібна, або видаленням. «Хай полежить» заборонене тим самим
			 * правилом, що й для файлів (PS-REACHABILITY).
			 *
			 * У `MindStep` цей клас коштував двох функцій: `authService.init()` без
			 * жодного виклику (не працювало злиття рекорду з хмарою) і
			 * `subscribeToPublicRooms()`, через який скарга звучала як «список
			 * оновлюється лише кнопкою».
			 */
			expect(
				[...new Set(orphans)].sort(),
				`підписка без жодного шляху іззовні:\n${orphans.join('\n')}`
			).toEqual([]);
		});
	});

	describe('§ 3.3 аксесор контексту', () => {
		const withGet = sources.filter((f) => /\bgetContext\s*\(/.test(codeOf(f)));

		it('getContext не викликається з компонента напряму', () => {
			/*
			 * Тут НЕМАЄ канарки, і це свідомо: Context API у проєкті не вживається
			 * взагалі (0 викликів на день коміта), а канарка «знайдено хоч один
			 * getContext» валила б прогін на порожньому переліку — тобто вимагала б
			 * додати контекст заради зеленої галочки.
			 *
			 * Замість канарки — ратчет: щойно `getContext` з'явиться, він мусить
			 * жити в модулі поруч із `setContext` (пара `set*`/`get*`, ключ-`Symbol`,
			 * `get*` кидає без контексту), а не просто в `.svelte`.
			 */
			const direct = withGet.filter((f) => f.endsWith('.svelte'));
			expect(
				direct,
				`getContext просто в компоненті — потрібен аксесор поруч із класом:\n${direct.join('\n')}`
			).toEqual([]);
		});

		it('кожен getContext має setContext у тому ж модулі', () => {
			const unpaired = withGet.filter((f) => !/\bsetContext\s*\(/.test(codeOf(f)));
			expect(unpaired, `getContext без пари setContext у модулі:\n${unpaired.join('\n')}`).toEqual(
				[]
			);
		});
	});
});
