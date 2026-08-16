/**
 * Крок `prepare`: згенерувати типи SvelteKit і встановити git-гачки.
 *
 * **Чому це окремий файл, а не рядок у `package.json`.** Там стояло
 * `svelte-kit sync || echo '' ; husky` — і воно працює лише в POSIX-шеллі. На
 * Windows npm виконує скрипти через `cmd.exe`, де `;` не розділяє команди:
 * `prepare` падав із кодом 1, до `husky` не доходило ніколи, гачок не
 * встановлювався, і версія стояла на місці 30 комітів поспіль. Помітити це
 * було нічим: `npm install` про це не кричить, а гачок, якого немає, просто
 * мовчить.
 *
 * Два кроки з РІЗНИМ ставленням до збою, і це навмисно:
 *
 *  * `svelte-kit sync` — генерація типів. Може впасти на чистій машині до
 *    встановлення залежностей, і це не привід зривати `npm install`;
 *  * `husky` — встановлення гачків. Його падіння приховувати НЕ можна: саме
 *    так і виникла тиша, яку цей файл лікує.
 */
import { spawnSync } from 'node:child_process';

/** `shell: true` — щоб знайшлися бінарники з `node_modules/.bin`. */
const run = (command) => spawnSync(command, { shell: true, stdio: 'inherit' }).status ?? 1;

if (run('svelte-kit sync') !== 0) {
	console.warn('[prepare] svelte-kit sync не вдався — типи згенеруються пізніше');
}

const hooks = run('husky');
if (hooks !== 0) {
	console.error('[prepare] husky не встановив гачки: версія не підніматиметься при коміті');
	process.exit(hooks);
}
