#!/usr/bin/env node
/**
 * Прапори країн зі `country-flag-icons` — у `static/flags/`.
 *
 * ## Чому копія в статику, а не імпорт із пакета
 *
 * Три причини, і третя вирішальна.
 *
 * Прапор потрібен ЛЮБИЙ: країну дає геолокація за IP або вибір людини, тобто
 * заздалегідь відомо лише те, що це один із двохсот шістдесяти пʼяти. Ставити їх
 * у бандл через `import.meta.glob` означало б згенерувати 265 модулів-чанків
 * заради одного-двох, які справді покажуться.
 *
 * Друге: CSP. Файл зі `static/` віддається з власного походження й покривається
 * `img-src 'self'` без жодної правки політики. Інлайновий SVG вимагав би розбору
 * вмісту, а зовнішній CDN — нового домену в політиці.
 *
 * Третє й головне: сайт СТАТИЧНИЙ і кладеться на GitHub Pages. Файл у
 * `static/` — це просто файл на CDN Pages: браузер кешує його окремо, і другий
 * гравець із тієї самої країни не завантажує нічого.
 *
 * ## Що це коштує
 *
 * 906 КБ у репозиторії на 265 файлів, у середньому 3,5 КБ на прапор, найбільший
 * 8 КБ. Жоден не містить ні `<style>`, ні `<script>` — перевірено скриптом
 * нижче, бо саме вони зробили б файл небезпечним під CSP.
 *
 * Сам пакет лишається devDependency: він потрібен рівно тут, щоб оновити копію,
 * коли прапор країни зміниться.
 *
 * Запуск: `npm run sync:flags`. Результат КОМІТИТЬСЯ — інакше збірка залежала б
 * від `node_modules` на машині, де її запускають.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FROM = join('node_modules', 'country-flag-icons', '3x2');
const TO = join('static', 'flags');
const LIST = join('src', 'lib', 'config', 'countries.generated.ts');

if (!existsSync(FROM)) {
	console.error(`sync-flags: немає ${FROM} — спершу \`npm install\``);
	process.exit(1);
}

const files = readdirSync(FROM).filter((name) => name.endsWith('.svg'));
if (files.length === 0) {
	console.error('sync-flags: у пакеті немає жодного .svg — перевірити версію');
	process.exit(1);
}

/*
 * ПЕРЕВІРКА БЕЗПЕКИ ПЕРЕД КОПІЮВАННЯМ, а не після.
 *
 * `<style>` або `<script>` усередині SVG — це виконуваний вміст, який під CSP
 * або блокується (і прапор зникає), або вимагає послаблення політики. Жоден
 * файл цього набору їх не має, і саме тому перевірка тут дешева: вона стереже
 * майбутнє оновлення пакета, а не поточний стан.
 */
const unsafe = [];
const copied = [];

// Тека перестворюється, щоб зникли прапори країн, яких у новій версії пакета
// вже немає: інакше в статиці лишався б файл, на який ніщо не посилається.
rmSync(TO, { recursive: true, force: true });
mkdirSync(TO, { recursive: true });

for (const name of files) {
	const svg = readFileSync(join(FROM, name), 'utf8');
	if (/<(style|script)[\s>]/i.test(svg)) {
		unsafe.push(name);
		continue;
	}
	// Малими літерами: код країни в адресі не мусить залежати від регістру
	// файлової системи — Windows його не розрізняє, а Pages розрізняє.
	const lower = name.toLowerCase();
	writeFileSync(join(TO, lower), svg);
	copied.push(lower.replace('.svg', ''));
}

if (unsafe.length > 0) {
	console.error(`sync-flags: у ${unsafe.length} файлах є style/script: ${unsafe.join(', ')}`);
	process.exit(1);
}

copied.sort();

const generated = `/**
 * ГЕНЕРОВАНО \`npm run sync:flags\` — не правити руками.
 *
 * Перелік країн, для яких у \`static/flags/\` є прапор. Назви країн тут навмисно
 * немає: їх дає \`Intl.DisplayNames\` мовою інтерфейсу, тобто двісті шістдесят пʼять
 * назв × чотири мови не потрапляють ні в репозиторій, ні в бандл.
 */
export const FLAG_COUNTRIES: readonly string[] = [
${copied.map((code) => `\t'${code}'`).join(',\n')}
];
`;

writeFileSync(LIST, generated);

console.log(`sync-flags: ${copied.length} прапорів у ${TO}, перелік у ${LIST}`);
