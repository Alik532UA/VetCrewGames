// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { GAMES, NOT_REPLAY, stripComments } from '../scripts/replay-stamp.mjs';

/**
 * ВЕРСІЯ ПРАВИЛ ГРИ ПІДНІМАЄТЬСЯ РАЗОМ ІЗ КОДОМ ПЕРЕПРОГОНУ (аудит 2026-09-26).
 *
 * Три зміни перепрогону вікторини вийшли під тією самою четвіркою, і вкладки двох
 * редакцій в одній кімнаті рахували різних гравців. Гейт доти перевіряв лише
 * нижню межу версії. Тут — штамп коду, з якого рахується партія, і версія, під
 * якою його поставлено (`scripts/replay-stamp.mjs`).
 *
 * Реалізація одна — скрипт; тест її ЗАПУСКАЄ, а не рахує хеш удруге (той самий
 * принцип, що в `rules-stamp.test.ts`).
 *
 * Зворотні експерименти: змінити код у будь-якому модулі перепрогону — червоніє
 * перший; прибрати відмову «код змінився, а версія та сама» — третій.
 */
const SCRIPT = resolve('scripts/replay-stamp.mjs');

function run(args: string[], cwd = process.cwd()): { code: number; out: string } {
	try {
		const out = execFileSync('node', [SCRIPT, ...args], {
			cwd,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		});
		return { code: 0, out };
	} catch (error) {
		const failure = error as { status?: number; stdout?: string; stderr?: string };
		return { code: failure.status ?? 1, out: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
	}
}

/** Локальні не-типові імпорти файлу: `$lib/…` і відносні, до файлу на диску. */
function localImports(file: string): string[] {
	const found: string[] = [];
	for (const m of readFileSync(file, 'utf8').matchAll(
		/^import\s+(type\s+)?([\s\S]*?)\s+from\s+'([^']+)'/gm
	)) {
		if (m[1]) continue;
		const names = m[2]
			.replace(/[{}]/g, '')
			.split(',')
			.map((name) => name.trim())
			.filter(Boolean);
		if (names.length > 0 && names.every((name) => name.startsWith('type '))) continue;
		const spec = m[3];
		const base = spec.startsWith('$lib/')
			? `src/lib/${spec.slice(5)}`
			: spec.startsWith('.')
				? join(dirname(file), spec).replace(/\\/g, '/')
				: null;
		if (base === null) continue;
		const target = [base, `${base}.ts`, `${base}.svelte.ts`].find(
			(candidate) => existsSync(candidate) && statSync(candidate).isFile()
		);
		found.push(target ?? base);
	}
	return found;
}

describe('штамп коду перепрогону', () => {
	/**
	 * ПЕРЕЛІК ЗАМКНЕНИЙ (шостий аудит, A2): кожен локальний модуль, який імпортують
	 * модулі перепрогону, або сам під штампом, або названий у `NOT_REPLAY` із причиною.
	 * Доти штамп не бачив ні пулів питань, ні колоди, ні генератора: нова тварина
	 * роздавала з того самого зерна іншу дошку, а версія лишалася та сама.
	 *
	 * Зворотний експеримент: прибрати з переліку пар `config/memory-game.ts` — червоніє.
	 */
	it('кожен імпорт модуля перепрогону — під штампом або названий винятком', () => {
		const loose: string[] = [];
		for (const [game, { files }] of Object.entries(GAMES)) {
			for (const file of files) {
				for (const target of localImports(file)) {
					if (files.includes(target) || target in NOT_REPLAY) continue;
					loose.push(`${game}: ${file} → ${target}`);
				}
			}
		}
		expect(
			loose,
			`модуль перепрогону імпортує те, чого штамп не бачить:\n${loose.join('\n')}`
		).toEqual([]);
	});

	// Прострочений виняток — така сама дірка, як його відсутність: він сховав би наступний.
	it('винятки — лише ті, що справді імпортуються', () => {
		const imported = new Set(
			Object.values(GAMES).flatMap(({ files }) => files.flatMap((file) => localImports(file)))
		);
		const stale = Object.keys(NOT_REPLAY).filter((file) => !imported.has(file));
		expect(stale, 'виняток більше не потрібен — прибрати з NOT_REPLAY').toEqual([]);
	});

	it('збігається з кодом і з версіями правил', () => {
		const { code, out } = run(['--check']);
		expect(code, `штамп розійшовся з кодом перепрогону:\n${out}`).toBe(0);
		expect(out).toContain('штампи збігаються');
	});

	it('коментар штампа не міняє, рядок у лапках — не коментар', () => {
		expect(stripComments('a /* докблок */ b // рядок\nc')).toBe(stripComments('a  b \nc'));
		expect(stripComments("const s = '// не коментар';")).toContain('// не коментар');
		expect(stripComments('const t = `/* теж ні */`;')).toContain('/* теж ні */');
	});

	/**
	 * КОД ЗМІНИВСЯ, А ВЕРСІЯ ТА САМА — перештампувати мовчки не можна: або підняти
	 * версію, або явно сказати «перепрогін той самий».
	 */
	it('змінений код без нової версії штампується лише з явним --same', () => {
		const sandbox = mkdtempSync(join(tmpdir(), 'replay-stamp-'));
		try {
			const files = new Set([
				'src/lib/config/replay-stamps.json',
				'src/lib/config/roomRules.ts',
				...Object.values(GAMES).flatMap((game) => game.files)
			]);
			for (const file of files) {
				mkdirSync(dirname(join(sandbox, file)), { recursive: true });
				copyFileSync(file, join(sandbox, file));
			}
			const target = join(sandbox, GAMES.quiz.files[0]);
			writeFileSync(target, `${readFileSync(target, 'utf8')}\nexport const changed = 1;\n`);

			const refused = run([], sandbox);
			expect(refused.code, 'змінений перепрогін перештамповано мовчки').toBe(1);
			expect(refused.out).toContain('QUIZ_RULES_VERSION');

			const confirmed = run(['--same=quiz'], sandbox);
			expect(confirmed.code, confirmed.out).toBe(0);
			expect(run(['--check'], sandbox).code, 'після підтвердження штамп не збігся').toBe(0);
		} finally {
			rmSync(sandbox, { recursive: true, force: true });
		}
	});
});
