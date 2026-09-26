// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { GAMES, stripComments } from '../scripts/replay-stamp.mjs';

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

describe('штамп коду перепрогону', () => {
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
