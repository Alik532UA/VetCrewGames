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
/** Прапори, які тримає сам проєкт: заміни й доповнення до пакета. */
const OWN = join('assets', 'flags');

/**
 * ЧОГО В ПЕРЕЛІКУ НЕМАЄ, і чому це вирішує проєкт, а не пакет.
 *
 * Пакет — це набір зображень, а не позиція. Тут позиція є, і вона та сама, що в
 * сусідньому `CV`: кримськотатарський прапор, «Одеса» в пореформеній
 * транслітерації, «російська — мова агресора» в локалі DigitalWorkshop.
 *
 * Ключ — код, значення — причина. Порожня причина заборонена перевіркою нижче:
 * без неї перелік за півроку стане місцем, куди зсипають незручне.
 */
const EXCLUDED = {
	ru: 'прапор держави-агресора. Рішення автора проєкту, 2026-08-24',
	xa: 'не країна: `XA` — псевдолокаль ICU для перевірки перекладів (штучні акценти). У списку країн вона стояла з назвою «Псевдоакценти»'
};

/**
 * ВЛАСНІ ПРАПОРИ: код → файл у `assets/flags/`.
 *
 * Заміна `by` — біло-червоно-білий: історичний прапор 1918 року, державний у
 * 1991–1995, а з протестів 2020-го символ демократичного руху й діаспори. Назву
 * країни це не змінює: її й далі дає `Intl.DisplayNames` («Білорусь»).
 *
 * `xr` — Російський добровольчий корпус. Код не з ISO, а з ДІАПАЗОНУ ВІЛЬНОГО
 * ПРИЗНАЧЕННЯ (`XA`–`XZ`), який стандарт прямо лишає застосункам; той самий
 * діапазон використовує й сам пакет — `XK` для Косова, `XO` для Південної
 * Осетії, `XC` для Північного Кіпру.
 *
 * Дві літери — не смак, а вимога БАЗИ: правило `country` в
 * `database.rules.json` перевіряє `newData.val().length === 2`, тож трилітерний
 * `rvc` база просто не прийняла б.
 *
 * Назви для власних кодів `Intl.DisplayNames` не знає, тож вони приходять зі
 * словника проєкту — див. `countryName` у `config/countries.ts`.
 */
const OWN_FLAGS = {
	by: 'заміна прапора з пакета на біло-червоно-білий',
	xr: 'Російський добровольчий корпус; коду в ISO немає, взято з діапазону вільного призначення'
};

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

/** Та сама перевірка для будь-якого джерела: пакет чи власний файл. */
function put(code, svg, origin) {
	if (/<(style|script)[\s>]/i.test(svg)) {
		unsafe.push(`${code} (${origin})`);
		return;
	}
	// Малими літерами: код країни в адресі не мусить залежати від регістру
	// файлової системи — Windows його не розрізняє, а Pages розрізняє.
	writeFileSync(join(TO, `${code}.svg`), svg);
	copied.push(code);
}

const skipped = [];

for (const name of files) {
	const code = name.toLowerCase().replace('.svg', '');

	if (code in EXCLUDED) {
		skipped.push(code);
		continue;
	}
	/*
	 * Власний файл ПЕРЕКРИВАЄ пакет, і копіювати обидва не можна: другий запис
	 * перетер би перший, а який саме виграє — залежало б від порядку читання
	 * теки. Тому пакетний варіант пропускається тут, а власний кладеться нижче.
	 */
	if (code in OWN_FLAGS) continue;

	put(code, readFileSync(join(FROM, name), 'utf8'), 'пакет');
}

for (const [code, reason] of Object.entries(OWN_FLAGS)) {
	if (reason.length < 20) {
		console.error(`sync-flags: у власного прапора ${code} немає причини`);
		process.exit(1);
	}
	const file = join(OWN, `${code}.svg`);
	if (!existsSync(file)) {
		console.error(`sync-flags: обіцяно власний прапор ${code}, а файлу ${file} немає`);
		process.exit(1);
	}
	put(code, readFileSync(file, 'utf8'), 'проєкт');
}

for (const [code, reason] of Object.entries(EXCLUDED)) {
	if (reason.length < 20) {
		console.error(`sync-flags: у виключеного ${code} немає причини`);
		process.exit(1);
	}
	if (!skipped.includes(code)) {
		// Пакет міг перейменувати або прибрати файл: тоді запис у EXCLUDED більше
		// нічого не виключає, і мовчати про це не можна — наступний читач вважав
		// би, що прапор і далі прибирається саме тут.
		console.error(`sync-flags: ${code} стоїть у EXCLUDED, але в пакеті його немає`);
		process.exit(1);
	}
}

console.log(
	`sync-flags: прибрано ${skipped.length} (${skipped.join(', ')}), власних ${Object.keys(OWN_FLAGS).length} (${Object.keys(OWN_FLAGS).join(', ')})`
);

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
