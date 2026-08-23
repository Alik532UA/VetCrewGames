/**
 * ШТАМП ВЕРСІЇ ПРАВИЛ: одне число, за яким видно, чи викладене те, що в git.
 *
 * Використання:
 *   node scripts/rules-stamp.mjs           поставити штамп у правила й у код
 *   node scripts/rules-stamp.mjs --check   лише звірити (для CI); не змінює файлів
 *
 * ## Задача, і чому її не розв'язував жоден наявний гейт
 *
 * `npm run check:rules` піднімає емулятор і доводить, що ФАЙЛ правильний. Що саме
 * лежить у консолі Firebase, він не знає й знати не може — правила виконуються на
 * боці Firebase, а викладає їх людина руками. Тобто між «гейт зелений» і «база
 * захищена» лежала прогалина, яку не бачив ніхто: у `PROJECT-CONTEXT.md` стан
 * консолі описувало рукописне речення, і воно вже було неправдою (гілки `lobby`
 * у продакшні немає — заміряно в браузері 2026-08-23).
 *
 * ## Чому штамп живе В ТЕКСТІ ПРАВИЛ, а не полем у базі
 *
 * Поле в базі дрейфує точно так само, як самі правила: забув оновити — отримав
 * хибне «все свіже». Штамп же тут — це УМОВА В ПРАВИЛІ:
 *
 *     "__rulesVersion": { "$v": { ".read": "auth != null && $v === '<штамп>'" } }
 *
 * Клієнт пробує прочитати `/__rulesVersion/<очікуваний штамп>`. Дозвіл означає
 * «правила цієї редакції викладені», відмова — «ні». Даних за цим шляхом немає й
 * не потрібно: правила оцінюються ДО існування вузла. Заміряно на емуляторі:
 * очікуваний штамп → 200 і `null`, інший → 401, спроба перелічити гілку → 401.
 *
 * ## Чому ХЕШ, а не лічильник
 *
 * Лічильник, який піднімають руками, забувають — і тоді штамп бреше в найгіршому
 * напрямку: каже «свіже» там, де відстало. Хеш вивести з файлу неможливо забути:
 * змінив правила — змінився штамп, а `--check` у CI не дає закомітити розходження.
 *
 * ## Чому хешується СЕМАНТИКА, а не файл
 *
 * Firebase коментарі відкидає, тож на поведінку вони не впливають. Якби хеш
 * рахувався з усього файлу, правка одного коментаря вимагала б викладати правила
 * заново, інакше CI червонів би — і гейт швидко почали б ігнорувати. Тому перед
 * хешуванням прибираються коментарі, сам блок штампа й зайві пробіли: штамп
 * змінюється рівно тоді, коли змінюється ПОВЕДІНКА.
 *
 * Прибирання коментарів — станковою машиною, а не регуляркою: `//` усередині
 * рядка в лапках коментарем не є, і `.replace(/\/\/.*$/gm, '')` тихо зіпсував би
 * правило, у якому таке трапиться.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const RULES = 'database.rules.json';
const CONSTANT = 'src/lib/net/rulesVersion.ts';

/** Скільки шістнадцяткових знаків штампа. */
const STAMP_LENGTH = 12;

/**
 * Прибрати коментарі, не зачепивши рядків у лапках.
 *
 * @param {string} text
 */
function stripComments(text) {
	let out = '';
	let inString = false;
	let inLine = false;
	let inBlock = false;

	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		const next = text[i + 1];

		if (inLine) {
			if (ch === '\n') {
				inLine = false;
				out += ch;
			}
			continue;
		}
		if (inBlock) {
			if (ch === '*' && next === '/') {
				inBlock = false;
				i += 1;
			}
			continue;
		}
		if (inString) {
			// Екранований символ переходить у вивід разом із похилою рискою: інакше
			// `\"` закрив би рядок і решта файлу читалася б як код.
			if (ch === '\\') {
				out += ch + (next ?? '');
				i += 1;
				continue;
			}
			if (ch === '"') inString = false;
			out += ch;
			continue;
		}
		if (ch === '"') {
			inString = true;
			out += ch;
			continue;
		}
		if (ch === '/' && next === '/') {
			inLine = true;
			i += 1;
			continue;
		}
		if (ch === '/' && next === '*') {
			inBlock = true;
			i += 1;
			continue;
		}
		out += ch;
	}
	return out;
}

/**
 * Вирізати блок `__rulesVersion` разом зі штампом.
 *
 * Без цього хеш залежав би від самого себе: вписали штамп — змінився вміст —
 * змінився хеш, і збіжності не було б ніколи.
 *
 * Вирізається підрахунком дужок, а не регуляркою: блок містить вкладені `{}`.
 *
 * @param {string} text
 */
function withoutStamp(text) {
	const key = '"__rulesVersion"';
	const at = text.indexOf(key);
	if (at === -1) return text;

	let depth = 0;
	let end = -1;
	for (let i = text.indexOf('{', at); i < text.length; i += 1) {
		if (text[i] === '{') depth += 1;
		else if (text[i] === '}') {
			depth -= 1;
			if (depth === 0) {
				end = i + 1;
				break;
			}
		}
	}
	if (end === -1) throw new Error('блок __rulesVersion не закритий — правила зламані');
	// Кома після блока теж належить йому: без неї лишиться `,,`.
	const tail = text.slice(end).replace(/^\s*,/, '');
	return text.slice(0, at) + tail;
}

/**
 * Штамп = хеш семантики правил.
 *
 * @param {string} text
 */
function stampOf(text) {
	const semantic = stripComments(withoutStamp(text)).replace(/\s+/g, ' ').trim();
	return createHash('sha256').update(semantic).digest('hex').slice(0, STAMP_LENGTH);
}

/** Штамп, який зараз вписаний у правила. `null` — блока немає. */
function currentStamp(text) {
	const found = /\$v === '([0-9a-f]+)'/.exec(text);
	return found ? found[1] : null;
}

const source = readFileSync(RULES, 'utf8');
const want = stampOf(source);
const have = currentStamp(source);
const check = process.argv.includes('--check');

if (check) {
	const problems = [];
	if (have === null) problems.push(`у ${RULES} немає блока __rulesVersion`);
	else if (have !== want) problems.push(`штамп у ${RULES}: ${have}, а семантика дає ${want}`);

	const declared = /RULES_VERSION = '([0-9a-f]+)'/.exec(readFileSync(CONSTANT, 'utf8'))?.[1];
	if (declared !== want) problems.push(`штамп у ${CONSTANT}: ${declared}, а семантика дає ${want}`);

	if (problems.length > 0) {
		console.error('\nШТАМП ПРАВИЛ РОЗІЙШОВСЯ З ЇХНІМ ВМІСТОМ:');
		for (const problem of problems) console.error(`  • ${problem}`);
		console.error('\nВиконати: npm run rules:stamp — і викласти правила заново.\n');
		process.exit(1);
	}
	console.log(`rules-stamp: штамп ${want} збігається з вмістом правил.`);
	process.exit(0);
}

if (have === want) {
	console.log(`rules-stamp: штамп уже ${want}, міняти нічого.`);
} else {
	const stamped =
		have === null
			? source.replace(
					// CRLF-терпимо: репозиторій живе на Windows, і `\{\n` збіглося б лише
					// поки робоча копія має LF. Той самий скрипт піде в сусідні проєкти.
					/("rules": \{\r?\n)/,
					`$1${blockFor(want)}`
				)
			: source.replace(/\$v === '[0-9a-f]+'/, `$v === '${want}'`);
	if (stamped === source) throw new Error(`не вдалося вписати штамп у ${RULES}`);
	writeFileSync(RULES, stamped);
	console.log(`rules-stamp: у ${RULES} — ${have ?? 'нічого'} → ${want}`);
}

writeFileSync(CONSTANT, constantFor(want));
console.log(`rules-stamp: у ${CONSTANT} — ${want}`);

/**
 * Блок правила зі штампом. Ставиться першим у `rules`, щоб його було видно.
 *
 * @param {string} stamp
 */
function blockFor(stamp) {
	return `    /*
     * ШТАМП ВЕРСІЇ — не дані, а УМОВА. Ставить \`scripts/rules-stamp.mjs\`.
     *
     * Дозвіл прочитати \`/__rulesVersion/<штамп>\` і є відповіддю «правила цієї
     * редакції викладені»; вузла за цим шляхом не існує й не потрібно, бо
     * правила оцінюються ДО існування. Інший штамп і спроба перелічити гілку
     * дають відмову — заміряно на емуляторі.
     *
     * Штамп — хеш СЕМАНТИКИ цього файлу (без коментарів і без самого блока), тож
     * правка коментаря не вимагає нового викладання, а зміна поведінки вимагає.
     * Руками не правити: \`npm run rules:stamp\`.
     */
    "__rulesVersion": {
      "$v": { ".read": "auth != null && $v === '${stamp}'" }
    },

`;
}

/** @param {string} stamp */
function constantFor(stamp) {
	return `/**
 * ЗГЕНЕРОВАНО \`scripts/rules-stamp.mjs\` — РУКАМИ НЕ ПРАВИТИ.
 *
 * Хеш семантики \`database.rules.json\`. За ним застосунок і CI перевіряють, чи
 * викладені в Firebase правила збігаються з тими, що лежать у git: клієнт пробує
 * прочитати \`/__rulesVersion/\${RULES_VERSION}\`, і дозвіл означає «збігаються».
 *
 * Чому це не поле в базі, чому хеш, а не лічильник, і чому хешується семантика, а
 * не файл — усе в докблоці самого скрипта.
 */
export const RULES_VERSION = '${stamp}';
`;
}
