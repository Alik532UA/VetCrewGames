/**
 * Запустити Firebase CLI, не ставлячи його в залежності проєкту.
 *
 * Використання: `node scripts/firebase-cli.mjs emulators:exec --only database "…"`.
 *
 * ЧОМУ НЕ devDependency. `firebase-tools` тягне `superstatic`, який оголошує
 * `node: "20 || 22 || 24"`. У проєкті стоїть `engine-strict=true` (`.npmrc`) —
 * свідоме рішення, бо саме воно ловить розходження версії Node між машиною й
 * CI. Разом це означає, що на Node 25 падає не встановлення firebase-tools, а
 * `npm install` ЦІЛКОМ: жодну залежність поставити не вдається. Тобто інструмент
 * для перевірки правил зламав би щоденну роботу над рештою проєкту.
 *
 * ЧОМУ НЕ ПРОСТО npx. `npx` читає `.npmrc` із поточної теки, тож упирається в
 * той самий `engine-strict` і навіть не завантажує пакет.
 *
 * ЩО РОБИТЬ ЦЕ. Знімає перевірку рухомого складу РІВНО для цього одного виклику,
 * через змінну оточення дочірнього процесу. Вимкнути її тут безпечно й дешево:
 * це CLI, який ніколи не потрапляє ні в бандл, ні в браузер відвідувача, а
 * несумісність у ньому не гіпотетична, а вже перевірена — прогін на 15.27.0
 * проходить.
 *
 * ЧОМУ ЦЕ НЕ РЯДОК У package.json. Префікс `VAR=value команда` — синтаксис
 * POSIX-оболонки. На Windows npm-скрипти йдуть через `cmd.exe`, де такий рядок
 * не запускається взагалі, а `check:rules` мусить працювати на машині автора так
 * само, як у CI.
 */
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
if (args.length === 0) {
	console.error('firebase-cli.mjs: потрібні аргументи для firebase CLI');
	process.exit(2);
}

/** Мажор фіксуємо: `latest` міняв би поведінку гейта без жодного коміту. */
const CLI = 'firebase-tools@15';

/*
 * Аргументи склеюються в РЯДОК, і пробільні беруться в лапки вручну.
 *
 * Оболонка тут обовʼязкова: на Windows `npx` — це `npx.cmd`, а Node з версії 18
 * навмисно відмовляється запускати `.cmd` без `shell: true`. Але з оболонкою
 * масив аргументів просто конкатенується, тож `emulators:exec "node scripts/…"`
 * розпадався на два аргументи, і CLI казав «Too many arguments» — виміряно, це
 * була перша спроба.
 */
const command = [
	'npx',
	'--yes',
	CLI,
	...args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))
].join(' ');

const child = spawn(command, {
	stdio: 'inherit',
	shell: true,
	env: { ...process.env, npm_config_engine_strict: 'false' }
});

child.on('error', (error) => {
	console.error('firebase-cli.mjs: не вдалося запустити npx —', error.message);
	process.exit(1);
});

// Код виходу передається НАСКРІЗЬ: гейт, який завжди повертає 0, — це не гейт.
child.on('exit', (code, signal) => {
	if (signal) {
		console.error(`firebase-cli.mjs: процес зупинено сигналом ${signal}`);
		process.exit(1);
	}
	process.exit(code ?? 1);
});
