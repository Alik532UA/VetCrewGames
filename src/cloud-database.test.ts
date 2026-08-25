// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
		// переписує дані будь-якого іншого» — це не захист, а його вигляд.
		const broad = writes.filter((rule) => !/auth\.uid|hostUid/.test(rule));
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
		// По одному на кожен вузол із відомою формою: info, members/$uid,
		// moves/$seq, rooms/$code, myRooms/$uid/$code, presence/$code/$uid.
		expect(others, 'вузли з відомою формою не закриті "$other"').toBeGreaterThanOrEqual(6);
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
		 */
		const text = readFileSync('src/lib/controllers/pairsMatch.svelte.ts', 'utf8');
		const sort = text.match(/\.sort\(\([^)]*\)\s*=>\s*([^;]+?)\);/);
		expect(sort, 'сортування гравців не знайдено').not.toBeNull();
		expect(sort?.[1], 'сортування за order без тайбрейка за uid').toMatch(/uid/);
	});

	it('присутність перевіряється на форму й серверний час (§ 4.6)', () => {
		const presence = rulesCode.match(
			/"presence"\s*:\s*\{[\s\S]*?"\$uid"\s*:\s*\{([\s\S]*?)\n\s{8}\}/
		);
		expect(presence, 'правила для presence/$code/$uid не знайдено').not.toBeNull();
		expect(presence?.[1], 'форма присутності не перевіряється').toContain('".validate"');
		expect(presence?.[1], 'час присутності не серверний').toContain('now');
	});

	it('кожен шлях із коду має випадок у гейті (§ 3.5)', () => {
		/*
		 * Напрямок тут зворотний до § 3.3, і він ловить інший клас дефекту: шлях,
		 * у який застосунок пише, а правил для нього немає, забирає catch-all — і
		 * функція просто не працює. У сусідньому `Slovko` так пролежала зламана
		 * форма відгуку, у `MindStep` — кінець партії.
		 */
		const gate = readFileSync('scripts/check-rules.mjs', 'utf8');
		const paths = new Set<string>();
		for (const file of sources) {
			for (const m of readFileSync(file, 'utf8').matchAll(
				/\bref\s*\(\s*[^,)]+,\s*[`'"]\/?([a-z_][\w-]*)/gi
			)) {
				paths.add(m[1]);
			}
		}
		expect(paths.size, 'шляхів до бази не знайдено — перевірка мертва').toBeGreaterThan(0);
		const uncovered = [...paths].filter((p) => !gate.includes(p));
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

	it('кожна підписка на базу віддає відписку (§ 9.1)', () => {
		// Слухач, чия відписка не повертається, переживає перехід між сторінками:
		// кожен вхід у кімнату додає ще один, і жоден не знімається.
		const net = walk('src/lib/net').filter((f) => f.endsWith('.ts'));
		const listeners = net.filter((file) => /\bonValue\s*\(/.test(readFileSync(file, 'utf8')));
		expect(listeners.length, 'підписок не знайдено — перевірка мертва').toBeGreaterThan(0);
		const leaking = listeners.filter((file) => {
			const text = readFileSync(file, 'utf8');
			return !/\boff\s*\(|return\s*\(\)\s*=>/.test(text);
		});
		expect(leaking, `підписка без відписки:\n${leaking.join('\n')}`).toEqual([]);
	});

	it('версія правил гри піднята разом зі формою ходу (§ 8.4)', () => {
		// Форма ходу змінилася (з’явився `at`), тож стара збірка з кешу пише ходи,
		// які правило відкидає. Кімната мусить називати нову версію — інакше
		// невідповідність збірок виглядає не як версії, а як зламана гра.
		const page = readFileSync('src/routes/[[lang=lang]]/pairs/online/+page.svelte', 'utf8');
		const version = page.match(/RULES_VERSION\s*=\s*(\d+)/);
		expect(version, 'RULES_VERSION у сторінці не знайдено').not.toBeNull();
		expect(Number(version?.[1]), 'форма ходу з `at` вимагає версії ≥ 2').toBeGreaterThanOrEqual(2);
	});
});
