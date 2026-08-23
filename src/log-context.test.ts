import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ЖОДЕН ЗАПИС У ЖУРНАЛ НЕ ПЕРЕДАЄ ГОЛИЙ `Error`.
 *
 * ## Дефект, який це ловить, і чому його не видно очима
 *
 * `logService.error('network', 'room entry failed', error)` виглядає бездоганно й
 * друкує в звіті `{}`. Причина в `Error`: його `message` і `stack` — властивості
 * НЕПЕРЕЛІЧУВАНІ, тож `JSON.stringify(new Error('boom'))` дає рівно `{}`. А звіт
 * чеклиста складається саме серіалізацією.
 *
 * Наслідок гірший за відсутність запису: рядок у журналі Є, він каже, що щось
 * зламалося, і не каже ЩО. Автор надіслав такий звіт 2026-08-23 — `[ERROR]
 * [NETWORK] room entry failed {}` — і причину довелося виводити з часу, коли він
 * стався, а не з журналу.
 *
 * ## Чому перевірка по джерелах, а не тип
 *
 * Типом це не закрити: третій параметр `error()` навмисно `unknown`, бо в журнал
 * кладуть будь-який контекст. Звузити до «не Error» TypeScript не вміє —
 * `unknown` приймає все саме тому, що це `unknown`.
 *
 * ## Що це НЕ ловить
 *
 * Об'єкт, у якому голий `Error` лежить глибше: `{ детали: { error } }`. Такий
 * випадок у проєкті не трапився, а перевірка на будь-яку вкладеність вимагала б
 * розбору виразу, а не рядка. Межа названа, щоб зелений результат не читався як
 * «жодного `Error` у журналі немає взагалі».
 */
/**
 * Імена, які в цьому проєкті означають САМ обʼєкт помилки.
 *
 * `reason` тут НЕМАЄ навмисно, і це не послаблення. За конвенцією проєкту
 * `reason` — це вже РЯДОК: саме таку форму й радить повідомлення про падіння
 * нижче (`{ reason: String(error) }`), і саме так пишуть `net/lobby.ts`,
 * `net/ownRooms.ts` та решта. Перша редакція мала `reason` у списку — і
 * почервоніла на власному ж виправленні: `{ action, reason }`, де `reason` уже
 * рядок. Перевірка, що забороняє те, що сама радить, гірша за відсутню.
 *
 * `cause` лишається: це стандартне поле `Error`, і в журнал воно потрапляє
 * обʼєктом.
 */
const NAMES = ['error', 'err', 'e', 'cause'];

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(ts|svelte)$/.test(entry)) out.push(full.replace(/\\/g, '/'));
	}
	return out;
}

describe('контекст журналу серіалізується', () => {
	const files = walk('src').filter((file) => !file.endsWith('.test.ts'));

	it('перевірка жива: виклики журналу знайдено', () => {
		const calls = files.filter((file) => /logService\.(info|warn|error)\(/.test(readFileSync(file, 'utf8')));
		// Число не з голови: стільки файлів пишуть у журнал. Нуль означав би, що
		// перевірка дивиться не туди й зеленіє на порожньому місці.
		expect(calls.length).toBeGreaterThan(5);
	});

	it('жоден виклик не передає голий Error', () => {
		const bad: string[] = [];

		for (const file of files) {
			const source = readFileSync(file, 'utf8');
			/*
			 * `split(/\r?\n/)`, а не `split('\n')`, і це не косметика.
			 *
			 * Файли цього репозиторію мають РІЗНІ переводи рядка: частина в робочій
			 * копії LF, частина CRLF (git попереджає про це на кожному коміті). При
			 * розбитті лише по `\n` у CRLF-файлі кожен рядок закінчується `\r`, а `.`
			 * у регулярці НЕ матчить `\r` — тобто `(.*)$` не збігається взагалі, і
			 * такий файл проглядався як порожній.
			 *
			 * Заміряно: перевірка знаходила 4 дефекти з 5. П'ятий
			 * (`beta-test-checklists/+page.svelte`) мовчав саме тому, що лежить у
			 * CRLF.
			 */
			for (const [index, line] of source.split(/\r?\n/).entries()) {
				/*
				 * `(.*)$`, а не `([^;]*)$`. Перша редакція мала друге — і не знаходила
				 * НІЧОГО: виклик закінчується `error);`, тобто крапка з комою стоїть
				 * перед кінцем рядка, і клас, який виключає `;`, до кінця не доходить.
				 * Перевірка була зелена на чотирьох справжніх дефектах.
				 */
				const call = /logService\.(?:info|warn|error)\((.*)$/.exec(line);
				if (!call) continue;
				const args = call[1];

				for (const name of NAMES) {
					// Останній аргумент — сама змінна: `…, error)`.
					const bare = new RegExp(`,\\s*${name}\\s*\\)`);
					// Або скорочення в об'єкті: `{ error }`, `{ code, error }`.
					const shorthand = new RegExp(`\\{[^}]*(?:^|[{,\\s])${name}\\s*[},]`);
					if (bare.test(args) || shorthand.test(args)) {
						bad.push(`${file}:${index + 1} — ${name}`);
						break;
					}
				}
			}
		}

		expect(
			bad,
			'ГОЛИЙ Error У ЖУРНАЛІ — у звіті це буде `{}`:\n' +
				`${bad.join('\n')}\n\n` +
				'Передавати рядком: `{ reason: String(error) }` або `error instanceof Error ? error.message : String(error)`.'
		).toEqual([]);
	});
});
