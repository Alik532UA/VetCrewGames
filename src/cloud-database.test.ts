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
		const open = [
			...rulesCode.matchAll(/"\.(?:read|write)"\s*:\s*(?:true|"true")\s*[,}]/g)
		].map((m) => m[0]);
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
		const deletions = [...rulesCode.matchAll(/"\.write"\s*:\s*"([^"]*!newData\.exists\(\)[^"]*)"/g)];
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
			.filter((file) => /from\s+['"]firebase\//.test(readFileSync(file, 'utf8')));
		expect(bad, `Firebase у реактивному модулі:\n${bad.join('\n')}`).toEqual([]);
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
