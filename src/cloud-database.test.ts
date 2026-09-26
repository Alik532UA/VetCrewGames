// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PAIRS_RULES_VERSION } from '$lib/config/roomRules';
import { MOVE_SEQ_MAX } from '$lib/net/roomShape';

/**
 * Інваріанти роботи з хмарною базою за CLOUD-DATABASE-v8 § 14.
 *
 * **Чого ці перевірки НЕ роблять.** Вони не перевіряють самі правила доступу —
 * правила виконуються на боці Firebase, і побачити їх стан можна лише запитом
 * до емулятора. Це робить `npm run check:rules`, і він стоїть окремим джобом у
 * CI. Тут — форма коду й форма файлу правил: те, що видно з джерел і що можна
 * зламати правкою, не торкаючись бази.
 *
 * Обидві половини потрібні, і жодна не заміняє іншу: гейт над емулятором не
 * побачить статичного імпорту SDK, а ці інваріанти не побачать дозволу, який
 * забули звузити.
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

const sources = walk('src').filter((f) => /\.(ts|svelte)$/.test(f));
const rulesText = readFileSync('database.rules.json', 'utf8');
/** Коментарі не рахуються: у них `true` цитують саме як опис дефекту. */
const rulesCode = rulesText.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('хмарна база', () => {
	it('знаходить джерела — перевірка жива', () => {
		expect(sources.length).toBeGreaterThan(0);
		expect(rulesCode).toContain('"rules"');
	});

	it('файл правил прив’язаний через firebase.json (§ 2.2)', () => {
		expect(existsSync('firebase.json'), 'firebase.json немає').toBe(true);
		const config = JSON.parse(readFileSync('firebase.json', 'utf8'));
		const path = config.database?.rules;
		expect(path, 'firebase.json не вказує файл правил бази').toBeTruthy();
		expect(existsSync(path), `${path} немає`).toBe(true);
	});

	it('гейт правил існує і викликає емулятор (§ 3)', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
		expect(pkg.scripts['check:rules'], 'немає скрипта check:rules').toMatch(/emulators:exec/);
		expect(existsSync('scripts/check-rules.mjs')).toBe(true);
	});

	it('гейт правил стоїть у CI (§ 3.4)', () => {
		// Найдорожча помилка цього класу — правильно написана перевірка, яка не
		// входить у прогін: у PROJECT-CONTEXT.md з’являється рядок «правила
		// перевіряються», і наступний аудит читає його як факт.
		const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
		expect(workflow, 'джоб із check:rules відсутній у деплой-воркфлоу').toMatch(/check:rules/);
		expect(workflow, 'емулятору бази потрібна Java, кроку setup-java немає').toMatch(/setup-java/);
	});

	it('перевірка правил містить і позитивні, і негативні випадки (§ 3.1)', () => {
		const script = readFileSync('scripts/check-rules.mjs', 'utf8');
		const positives = [...script.matchAll(/allowed:\s*true/g)].length;
		const negatives = [...script.matchAll(/allowed:\s*false/g)].length;
		// Лише негативні — і перевірка зеленіє на правилах «заборонити все», тобто
		// на застосунку, який не працює. Лише позитивні — зеленіє на дірці.
		expect(positives, 'немає випадків «застосунок мусить це вміти»').toBeGreaterThan(0);
		expect(negatives, 'немає випадків «сторонній не мусить цього могти»').toBeGreaterThan(0);
	});

	it('у правилах немає безумовного дозволу (§ 1.3)', () => {
		const open = [...rulesCode.matchAll(/"\.(?:read|write)"\s*:\s*(?:true|"true")\s*[,}]/g)].map(
			(m) => m[0]
		);
		expect(open, `безумовний дозвіл у правилах:\n${open.join('\n')}`).toEqual([]);
	});

	it('кожен дозвіл вимагає авторизації (§ 1.2)', () => {
		const weak = [...rulesCode.matchAll(/"\.(?:read|write)"\s*:\s*"([^"]+)"/g)]
			.map((m) => m[1])
			.filter((rule) => !rule.includes('auth'));
		expect(weak, `дозвіл без згадки auth:\n${weak.join('\n')}`).toEqual([]);
	});

	it('право писати звужене до автора, а не лише до «авторизований» (§ 4)', () => {
		const writes = [...rulesCode.matchAll(/"\.write"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
		expect(writes.length).toBeGreaterThan(0);
		// `auth != null` сам по собі означає «будь-який зареєстрований користувач
		// переписує дані будь-якого іншого» — це не захист, а його вигляд. І саме
		// `auth.uid`, а не будь-яка згадка `hostUid` (аудит 2026-09-24): правило
		// «поле hostUid існує» проходило б перевірку, нічого не звужуючи.
		const broad = writes.filter((rule) => !/auth\.uid/.test(rule));
		expect(broad, `запис, не звужений до автора:\n${broad.join('\n')}`).toEqual([]);
	});

	it('журнал ходів можна лише створити (§ 4.2)', () => {
		// Без `!data.exists()` хід перезаписується, і журнал перестає бути правдою.
		// Без порівняння `by` з `auth.uid` хід підписується чужим ім’ям.
		const move = rulesCode.match(/"\$seq"\s*:\s*\{[\s\S]*?"\.write"\s*:\s*"([^"]+)"/);
		expect(move, 'правила для moves/$seq не знайдено').not.toBeNull();
		expect(move?.[1]).toContain('!data.exists()');
		expect(move?.[1]).toMatch(/newData\.child\('by'\)\.val\(\)\s*===\s*auth\.uid/);
	});

	it('серверний час ходу неможливо підробити (§ 4.6)', () => {
		// На цій позначці стоїть межа очікування черги. Якби `at` писав клієнт, він
		// оголошував би чужий хід простроченим коли завгодно й забирав чергу.
		const at = rulesCode.match(/"at"\s*:\s*\{\s*"\.validate"\s*:\s*"([^"]+)"/);
		expect(at, 'правила для moves/$seq/at не знайдено').not.toBeNull();
		expect(at?.[1]).toContain('now');
	});

	it('видалення дозволене лише як видалення (§ 4.3)', () => {
		// `!newData.exists()` не дає під виглядом видалення переписати вміст.
		const deletions = [
			...rulesCode.matchAll(/"\.write"\s*:\s*"([^"]*!newData\.exists\(\)[^"]*)"/g)
		];
		expect(deletions.length, 'немає жодного правила «лише знести»').toBeGreaterThan(0);
	});

	it('SDK не імпортується статично (§ 10.2)', () => {
		// Пакет `firebase` важить більше за всю збірку разом. Статичний імпорт
		// кладе його у спільний чанк, і кожен, хто зайшов почитати про заповідник,
		// тягне базу, у яку ніколи не звернеться.
		const bad = sources.filter((file) => {
			const text = readFileSync(file, 'utf8');
			return /^\s*import\s+(?!type\b)[^;]*from\s+['"]firebase\//m.test(text);
		});
		expect(bad, `статичний імпорт SDK:\n${bad.join('\n')}`).toEqual([]);
	});

	it('SDK не імпортується у .svelte.ts (§ 10.4)', () => {
		const bad = sources
			.filter((file) => file.endsWith('.svelte.ts'))
			// `import type` зникає при компіляції — це не мережа в модулі. Регекс без
			// цього виключення звинувачував би правильний код; саме таким його й
			// постачав канон до ревізії 8.4.
			.filter((file) =>
				/^\s*import\s+(?!type\b)[^;]*from\s+['"]firebase\//m.test(readFileSync(file, 'utf8'))
			);
		expect(bad, `Firebase у реактивному модулі:\n${bad.join('\n')}`).toEqual([]);
	});

	it('невідомі поля відкидаються, а не ігноруються (§ 4.6)', () => {
		/*
		 * `.validate` перевіряє лише ті поля, які НАЗВАНІ. Без `$other` перелік
		 * вище — перевірка частини форми, і головне: розсинхрон імені поля між
		 * кодом і правилом лишається тихим. У сусідньому `Slovko` правило
		 * валідувало `last_changed`, код писав `lastChanged`, і захист від
		 * підробленого часу не діяв ні на що.
		 */
		const validates = [...rulesCode.matchAll(/"\.validate"/g)].length;
		expect(validates, 'форма записів ніде не перевіряється').toBeGreaterThan(0);
		const others = [...rulesCode.matchAll(/"\$other"\s*:\s*\{\s*"\.validate"\s*:\s*false/g)].length;
		// УСІ НАЯВНІ, а не шість (аудит 2026-09-24): доти поріг лишав зеленим
		// прибирання десяти з шістнадцяти. Нова форма додає свій `$other`, і тоді
		// число тут піднімається; прибрати наявний — червоне.
		expect(others, 'вузли з відомою формою не закриті "$other"').toBeGreaterThanOrEqual(17);
	});

	it('порядок входу незмінний після першого запису (§ 4.6)', () => {
		// Із нього рахується черга ходів. Доти перевірявся лише `isNumber` — тобто
		// учасник, уже впущений у кімнату, забирав першу чергу в господаря.
		const order = rulesCode.match(/"order"\s*:\s*\{\s*"\.validate"\s*:\s*"([^"]+)"/);
		expect(order, 'правила для members/$uid/order не знайдено').not.toBeNull();
		expect(order?.[1], 'зміну порядку не заборонено').toMatch(
			/!data\.exists\(\)\s*\|\|\s*newData\.val\(\)\s*===\s*data\.val\(\)/
		);
		expect(order?.[1], 'діапазон порядку не обмежений').toMatch(/>=\s*1/);
	});

	it('черга ходів має детермінований тайбрейк (§ 8.3)', () => {
		/*
		 * Правило бази вміє заборонити ЗМІНУ порядку, але не вміє порахувати
		 * склад: у RTDB немає примітива «скільки дітей». Отже однакові `order`
		 * можливі — і без тайбрейка `sort` лишає порядок, у якому елементи
		 * приїхали з обʼєкта, тобто РІЗНИЙ на різних пристроях. Кожен вважає, що
		 * зараз хід іншого, і партія завмирає без жодної помилки.
		 *
		 * Сортування одне на обидві гри — `utils/roster.ts`: з нього ж береться склад,
		 * який заморожує старт. Тому друга половина перевірки стереже, щоб контролер
		 * не завів собі копію: копія без тайбрейка й дала б рівно цей дефект.
		 */
		const text = readFileSync('src/lib/utils/roster.ts', 'utf8');
		const sort = text.match(/\.sort\(\([^)]*\)\s*=>\s*([^;]+?)\);/);
		expect(sort, 'сортування гравців не знайдено').not.toBeNull();
		expect(sort?.[1], 'сортування за order без тайбрейка за uid').toMatch(/uid/);
		for (const file of [
			'src/lib/controllers/pairsMatch.svelte.ts',
			'src/lib/controllers/quizMatch.svelte.ts'
		]) {
			expect(readFileSync(file, 'utf8'), `${file} сортує гравців сам`).not.toMatch(
				/\.order\s*-\s*\w+\.order/
			);
		}
	});

	it('присутність перевіряється на форму й серверний час (§ 4.6)', () => {
		const presence = rulesCode.match(
			/"presence"\s*:\s*\{[\s\S]*?"\$uid"\s*:\s*\{([\s\S]*?)\n\s{8}\}/
		);
		expect(presence, 'правила для presence/$code/$uid не знайдено').not.toBeNull();
		expect(presence?.[1], 'форма присутності не перевіряється').toContain('".validate"');
		expect(presence?.[1], 'час присутності не серверний').toContain('now');
	});

	/**
	 * Шляхи з `update(ref(db, основа), значення)`: основа плюс кожен ключ ВЕРХНЬОГО
	 * рівня. Значення буває обʼєктом-літералом (ключі — літерали, `[`…`]` чи імена) або
	 * змінною, яку наповнюють присвоєннями `змінна[`…`] = …`. Ключі вкладених обʼєктів
	 * (`{ ...move, at: … }`) — не шляхи, тож рахується глибина дужок.
	 */
	function updatePaths(text: string): string[] {
		const found: string[] = [];
		const call = /\bupdate\s*\(\s*ref\s*\(\s*\w+\s*(?:,\s*([`'"])([^`'"]*)\1)?\s*\)\s*,\s*/g;
		for (const m of text.matchAll(call)) {
			const base = m[2] ?? '';
			const join = (key: string) => (base ? `${base}/${key}` : key);
			const rest = text.slice((m.index ?? 0) + m[0].length);
			if (rest.startsWith('{')) {
				for (const key of topLevelKeys(rest)) found.push(join(key));
				continue;
			}
			const name = /^[A-Za-z_$][\w$]*/.exec(rest)?.[0];
			if (!name) continue;
			const assign = new RegExp(`\\b${name}\\[\\s*([\`'"])([^\`'"]+)\\1\\s*\\]\\s*=`, 'g');
			for (const a of text.matchAll(assign)) found.push(join(a[2]));
			const literal = new RegExp(`\\b${name}\\s*(?::[^=]+)?=\\s*\\{`).exec(text);
			if (literal) {
				const start = (literal.index ?? 0) + literal[0].length - 1;
				for (const key of topLevelKeys(text.slice(start))) found.push(join(key));
			}
		}
		return found;
	}

	/**
	 * Ключі-шляхи обʼєкта-літерала, що починається з `{`: кожен ключ ВЕРХНЬОГО рівня
	 * (літерал, `[`…`]`, імʼя чи скорочення `{ status }`) і на будь-якій глибині —
	 * обчислений `[`…`]` зі скісною рискою: так пишеться шлях у розгортанні з умовою
	 * `...(c ? { [`handles/…`]: uid } : {})`. Імена у вкладених обʼєктах (`at`,
	 * `seq`) — поля значення, а не шляхи, і не рахуються.
	 */
	function topLevelKeys(source: string): string[] {
		const keys: string[] = [];
		let depth = 0;
		for (let i = 0; i < source.length; i += 1) {
			const ch = source[i];
			if (ch === '{' || ch === '[' || ch === '(') depth += 1;
			else if (ch === '}' || ch === ']' || ch === ')') {
				depth -= 1;
				if (depth === 0) break;
			}
			if (!(ch === '{' || ch === ',')) continue;
			const tail = source.slice(i);
			const quoted = /^[{,]\s*(?:\[\s*([`'"])([^`'"]+)\1\s*\]|([`'"])([^`'"]+)\3)\s*:/.exec(tail);
			const key = quoted?.[2] ?? quoted?.[4];
			if (key && (depth === 1 || key.includes('/'))) {
				keys.push(key);
				continue;
			}
			if (depth !== 1) continue;
			const named = /^[{,]\s*([A-Za-z_$][\w$]*)\s*[:,}]/.exec(tail);
			if (named) keys.push(named[1]);
		}
		return keys;
	}

	it('ключі багатошляхових записів — теж шляхи: розбір живий', () => {
		// Канарка на сам розбір: без неї мовчазне «нуль ключів» виглядало б як «усе
		// покрито». Рядки — рівно тих форм, що стоять у коді.
		const sample = [
			'await update(ref(db, `rooms/${code}`), {',
			"	'info/hostUid': move.by,",
			'	[`moves/${key}`]: { ...move, at: serverTimestamp() }',
			'});',
			'const wipe: Record<string, null> = {};',
			'wipe[`users/${uid}/following/${child.key}`] = null;',
			'await update(ref(db), wipe);',
			'await update(ref(db, `rooms/${code}/info`), { status, countdownAt: null });',
			'await update(ref(db), {',
			'	...(fresh ? { [`handles/${handle}`]: uid } : {}),',
			'	[`users/${uid}/profile`]: { name, at: serverTimestamp() }',
			'});'
		].join('\n');
		expect(updatePaths(sample)).toEqual([
			'rooms/${code}/info/hostUid',
			'rooms/${code}/moves/${key}',
			'users/${uid}/following/${child.key}',
			'rooms/${code}/info/status',
			'rooms/${code}/info/countdownAt',
			'handles/${handle}',
			'users/${uid}/profile'
		]);
	});

	it('кожен шлях із коду має випадок у гейті (§ 3.5)', () => {
		/*
		 * Напрямок тут зворотний до § 3.3, і він ловить інший клас дефекту: шлях,
		 * у який застосунок пише, а правил для нього немає, забирає catch-all — і
		 * функція просто не працює. У сусідньому `Slovko` так пролежала зламана
		 * форма відгуку, у `MindStep` — кінець партії.
		 *
		 * НА ПОВНУ ГЛИБИНУ (аудит 2026-09-24): доти звірявся лише перший сегмент, тож
		 * `rooms` у гейті «покривав» і `rooms/{code}/info/status`, і будь-яке нове поле.
		 * `${…}` з обох боків — будь-який сегмент; літерали мусять збігтися.
		 */
		const wild = (path: string) => path.replace(/\$\{[^}]+\}/g, '*').replace(/^\/|\/$/g, '');
		const gateText = readFileSync('scripts/check-rules.mjs', 'utf8');
		const gate = [
			...gateText.matchAll(
				/[`'"]((?:rooms|users|lobby|presence|myRooms|handles|find|leaders|__rulesVersion)(?:\/[^`'"]*)?)[`'"]/g
			)
		].map((m) => wild(m[1]));
		// Випадки гейту, що пишуть КІЛЬКОМА шляхами (`patch`), — так само основа плюс ключі.
		for (const m of gateText.matchAll(/\bpatch\s*\(\s*([`'"])([^`'"]*)\1\s*,\s*/g)) {
			const rest = gateText.slice((m.index ?? 0) + m[0].length);
			if (!rest.startsWith('{')) continue;
			for (const key of topLevelKeys(rest)) gate.push(wild(`${m[2]}/${key}`));
		}
		const paths = new Set<string>();
		for (const file of sources) {
			const text = readFileSync(file, 'utf8');
			for (const m of text.matchAll(/\bref\s*\(\s*[^,)]+,\s*([`'"])([^`'"]*)\1/g)) {
				const path = wild(m[2]);
				if (!path.startsWith('.info')) paths.add(path);
			}
			// І КЛЮЧІ БАГАТОШЛЯХОВИХ ЗАПИСІВ (аудит 2026-09-25): доти `update(ref(db), …)`
			// не давав жодного шляху, а `update(ref(db, `rooms/…`), …)` — лише корінь
			// кімнати, тож «на повну глибину» трималося тільки для літералів у `ref()`.
			for (const path of updatePaths(text)) paths.add(wild(path));
		}
		expect(paths.size, 'шляхів до бази не знайдено — перевірка мертва').toBeGreaterThan(20);
		// `leadSeq` пишеться ЛИШЕ багатошляховим записом (`rtdbRoom.takeLead`): без нього
		// розбір ключів міг би тихо не дійти до перевірки, і все одно зеленіти.
		expect(paths.has('rooms/*/info/leadSeq'), 'ключі `update()` не дійшли до перевірки').toBe(true);
		const covers = (code: string, tested: string) => {
			const a = code.split('/');
			const b = tested.split('/');
			return (
				b.length >= a.length && a.every((seg, i) => seg === '*' || b[i] === '*' || seg === b[i])
			);
		};
		const uncovered = [...paths].filter((path) => !gate.some((tested) => covers(path, tested)));
		expect(uncovered, `шлях без випадку в гейті:\n${uncovered.join('\n')}`).toEqual([]);
	});

	it('кожен orderByChild має ".indexOn" на своїй гілці (§ 7.4)', () => {
		// RTDB не відмовляє без індексу — вона віддає ГІЛКУ ЦІЛКОМ і сортує на
		// клієнті, лишивши попередження в консолі браузера. Тобто це тихо
		// зростаючий рахунок, а не помилка.
		const bad: string[] = [];
		for (const file of sources) {
			/*
			 * ВКЛАДЕНИЙ ШЛЯХ теж рахується: `orderByChild('info/hostUid')` — законний
			 * запит RTDB, і без `.indexOn` він так само тягне гілку цілком. Клас
			 * символів тут був `[\w.]+`, тобто без скісної риски, і такий запит
			 * перевірка мовчки пропускала.
			 *
			 * Коментарі знімаються, бо саме `info/hostUid` згадане в докблоці
			 * `ownRooms.ts` як приклад запиту, якого тут НЕМАЄ. Доти вузький клас
			 * символів випадково рятував від цієї згадки; тепер рятує розбір.
			 */
			const code = readFileSync(file, 'utf8')
				.replace(/\/\*[\s\S]*?\*\//g, ' ')
				.replace(/(^|[^:])\/\/.*/g, '$1 ');
			for (const m of code.matchAll(/orderByChild\s*\(\s*['"]([\w./-]+)['"]/g)) {
				if (!new RegExp(`"\\.indexOn"\\s*:\\s*(?:"${m[1]}"|\\[[^\\]]*"${m[1]}")`).test(rulesCode)) {
					bad.push(`${file}: orderByChild('${m[1]}') без ".indexOn"`);
				}
			}
		}
		expect(bad, `RTDB віддасть гілку цілком:\n${bad.join('\n')}`).toEqual([]);
	});

	it('покинуте прибирає власник, а не той, хто відкрив список (§ 9.3)', () => {
		/*
		 * Щоб прибирати ЧУЖЕ, потрібне право видаляти чуже — тобто дірка, яка
		 * заразом є примітивом «видалити всі кімнати». Тому збирач тут ходить за
		 * власним індексом `myRooms/{uid}` і користується правом, яке господар мав
		 * і без нього. Перевіряємо, що індекс справді свій і що збирач не читає
		 * переліку кімнат.
		 */
		expect(rulesCode, 'гілки myRooms у правилах немає').toContain('"myRooms"');
		const index = rulesCode.match(
			/"myRooms"\s*:\s*\{\s*"\$uid"\s*:\s*\{\s*"\.read"\s*:\s*"([^"]+)"/
		);
		expect(index, 'правила для myRooms/$uid не знайдено').not.toBeNull();
		expect(index?.[1], 'чужий індекс кімнат читається').toContain('$uid === auth.uid');

		const room = readFileSync('src/lib/net/rtdbRoom.ts', 'utf8');
		expect(room, 'збирача власних кімнат немає').toMatch(/pruneOwnRooms/);
		// Читання переліку кімнат відкрило б усі коди одним запитом — рівно те, що
		// правила забороняють. Збирач мусить ходити за індексом, а не за `rooms`.
		expect(room, 'збирач перелічує кімнати замість власного індексу').not.toMatch(
			/orderByChild\(['"]info\/hostUid/
		);
	});

	it('SDK не ініціалізується в тілі модуля (§ 10.1)', () => {
		// Синглтон, чий конструктор піднімає SDK, робить це на ІМПОРТІ — і тест,
		// який транзитивно тягне модуль, вимагає бойових ключів, щоб зібратися.
		const bad = sources.filter((file) =>
			/^(?:const|let|var)?\s*\w*\s*=?\s*initializeApp\s*\(/m.test(readFileSync(file, 'utf8'))
		);
		expect(bad, `initializeApp у тілі модуля:\n${bad.join('\n')}`).toEqual([]);
	});

	/**
	 * КОЖНА ПІДПИСКА ВІДДАЄ ВІДПИСКУ — ТУ, ЩО ПОВЕРНУВ `onValue` (§ 9.1, аудит 2026-09-26).
	 *
	 * Слухач, чия відписка не знімає його, переживає перехід між сторінками: кожен
	 * вхід у кімнату додає ще один. Доти ця перевірка задовольнялася словом `off(` у
	 * файлі — і саме `off` був дефектом: `off(ref, 'value', callback)` знімає лише ТОЙ
	 * САМИЙ колбек, а код передавав туди те, що повернув `onValue`. Не знімалося
	 * нічого, у семи підписках з восьми.
	 *
	 * Тепер `off` із SDK у мережевому шарі не береться взагалі, а результат кожного
	 * `onValue` кудись іде: повертається, присвоюється чи передається далі. Виклик
	 * на початку інструкції — відписка, викинута на місці.
	 *
	 * Зворотні експерименти: повернути `off` у будь-який модуль — червоніє перша
	 * перевірка; викинути результат `onValue` — друга.
	 */
	it('кожна підписка на базу віддає відписку — ту, що повернув `onValue` (§ 9.1)', () => {
		const net = walk('src/lib/net').filter((f) => f.endsWith('.ts') && !f.includes('.test.'));
		const code = (file: string) =>
			readFileSync(file, 'utf8')
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/^\s*\/\/.*$/gm, '');
		const listeners = net.filter((file) => /\bonValue\s*\(/.test(code(file)));
		expect(listeners.length, 'підписок не знайдено — перевірка мертва').toBeGreaterThan(3);

		const sdkOff =
			/\{[^}]*\boff\b[^}]*\}\s*=\s*(?:await\s+import\(\s*'firebase\/database'\s*\)|\w+Module\b)|import\s*\{[^}]*\boff\b[^}]*\}\s*from\s*'firebase\/database'|\.off\s*\(/;
		const withOff = net.filter((file) => sdkOff.test(code(file)));
		expect(withOff, `\`off\` із SDK не знімає відписки:\n${withOff.join('\n')}`).toEqual([]);

		const dropped: string[] = [];
		for (const file of listeners) {
			const text = code(file);
			for (const match of text.matchAll(/\bonValue\s*\(/g)) {
				const before = text.slice(0, match.index).trimEnd();
				if (before === '' || /[;{}]$|\bvoid$|\bawait$/.test(before)) dropped.push(file);
			}
		}
		expect(dropped, `результат \`onValue\` викинуто:\n${dropped.join('\n')}`).toEqual([]);
	});

	/**
	 * КОЖНА ПІДПИСКА ПОЯСНЮЄ СВОЄ СКАСУВАННЯ (аудит 2026-09-24).
	 *
	 * Підписку, якій перестали давати читати (вийшов з акаунта в іншій вкладці, стер
	 * його), база скасовує — і без третього аргументу `onValue` вона гасне МОВЧКИ:
	 * дошка стоїть, у журналі порожньо, а смуга «немає звʼязку» не зʼявляється, бо
	 * звʼязок якраз є. Виняток — службові вузли `.info/…`: їх SDK віддає сам, і
	 * скасувати їх нікому.
	 *
	 * Рахуються аргументи ВЕРХНЬОГО рівня: кома всередині колбека — не аргумент.
	 *
	 * Зворотний експеримент: прибрати третій аргумент у будь-якій підписці — червоніє.
	 */
	/**
	 * ВІДМОВА ПРАВИЛ РОЗПІЗНАЄТЬСЯ В ОДНОМУ МІСЦІ (аудит 2026-09-26): доти регулярка
	 * стояла в семи місцях двома написаннями, і кожна нова копія могла взяти не те.
	 *
	 * Зворотний експеримент: повернути регулярку в будь-який модуль — червоніє.
	 */
	it('відмова правил розпізнається лише в `net/denied.ts`', () => {
		const files = [...walk('src/lib'), ...walk('src/routes')].filter(
			(file) => /\.(ts|svelte)$/.test(file) && !file.includes('.test.')
		);
		const copies = files.filter(
			(file) =>
				!file.replace(/\\/g, '/').endsWith('net/denied.ts') &&
				/permission(\[_ \]|_)denied\//i.test(readFileSync(file, 'utf8'))
		);
		expect(files.length, 'джерел не знайдено — перевірка мертва').toBeGreaterThan(50);
		expect(copies, `копія розпізнавання відмови:\n${copies.join('\n')}`).toEqual([]);
	});

	it('кожна підписка на базу має обробник скасування', () => {
		const net = walk('src/lib/net').filter((f) => f.endsWith('.ts') && !f.includes('.test.'));
		const calls: Array<{ file: string; args: string[] }> = [];
		for (const file of net) {
			const text = readFileSync(file, 'utf8')
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/^\s*\/\/.*$/gm, '');
			// Службові вузли: змінна, якій присвоєно ref(db, '.info/…').
			const service = new Set(
				[...text.matchAll(/(\w+)\s*=\s*ref\(\s*db\s*,\s*'\.info\//g)].map((match) => match[1])
			);
			for (const match of text.matchAll(/\bonValue\s*\(/g)) {
				const args: string[] = [];
				let depth = 0;
				let current = '';
				for (let i = (match.index ?? 0) + match[0].length; i < text.length; i += 1) {
					const ch = text[i];
					if (depth === 0 && (ch === ',' || ch === ')')) {
						if (current.trim()) args.push(current.trim());
						current = '';
						if (ch === ')') break;
						continue;
					}
					if ('([{'.includes(ch)) depth += 1;
					if (')]}'.includes(ch)) depth -= 1;
					current += ch;
				}
				if (!service.has(args[0])) calls.push({ file, args });
			}
		}
		expect(calls.length, 'підписок не знайдено — перевірка мертва').toBeGreaterThan(3);
		const silent = calls
			.filter(({ args }) => args.length < 3)
			.map(({ file, args }) => `${file}: onValue(${args[0]}, …)`);
		expect(silent, `підписка без обробника скасування:\n${silent.join('\n')}`).toEqual([]);
	});

	/**
	 * МЕЖА НОМЕРА ХОДУ — ОДНА НА ПРАВИЛА Й КОД (аудит 2026-09-26). У правилі вона двічі
	 * (ключ і поле), у коді — `MOVE_SEQ_MAX`, з яким працює `LocalRoom`; розійшовшись,
	 * вони дали б тести партії на підставці, що приймає ходи, яких база не бере.
	 *
	 * Зворотний експеримент: змінити будь-яке з трьох чисел — червоніє.
	 */
	it('межа номера ходу в правилах — та сама, що в коді', () => {
		const rules = readFileSync('database.rules.json', 'utf8');
		const key = /\$seq < '(\d{6})'/.exec(rules)?.[1];
		const field =
			/"seq": \{ "\.validate": "newData\.isNumber\(\) && newData\.val\(\) >= 1 && newData\.val\(\) <= (\d+)" \}/.exec(
				rules
			)?.[1];
		expect(key, 'межі ключа ходу в правилах не знайдено').toBeDefined();
		expect(Number(key) - 1, 'межа ключа').toBe(MOVE_SEQ_MAX);
		expect(Number(field), 'межа поля seq').toBe(MOVE_SEQ_MAX);
	});

	it('версія правил гри піднята разом зі формою ходу (§ 8.4)', () => {
		// Форма ходу змінилася (з’явився `at`), тож стара збірка з кешу пише ходи,
		// які правило відкидає. Кімната мусить називати нову версію — інакше
		// невідповідність збірок виглядає не як версії, а як зламана гра.
		// З модуля, а не регулярним виразом зі сторінки: версія живе в `config/roomRules.ts`,
		// і її беруть і адаптер, і цей гейт (аудит 2026-09-24).
		expect(PAIRS_RULES_VERSION, 'форма ходу з `at` вимагає версії ≥ 2').toBeGreaterThanOrEqual(2);
	});
});
