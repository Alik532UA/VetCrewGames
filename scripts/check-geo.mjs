/**
 * Артефакти AI-пошуку в зібраному сайті — SEO-v8 § 7.5.
 *
 * Окремий модуль, а не рядки в `check-build`: перевірка робить власний розбір
 * `robots.txt`, і тримати парсер посеред перевірок HTML означало б ховати його
 * від очей. Викликається з `check-build` і додає свої знахідки в той самий
 * перелік проблем.
 *
 * **Чому розбір ПО ГРУПАХ, а не пошук підрядка.** Перша редакція канону
 * перевіряла `robots.includes('Disallow: /')` — а цей підрядок є в будь-якому
 * `Disallow: /test/`. Разом із другою умовою (`!robots.includes('Allow: /')`,
 * хибною, щойно хоч одна група має `Allow: /`) перевірка не спрацьовувала
 * ЖОДНОГО разу, зокрема на `robots.txt`, який справді блокував бота цілком.
 *
 * Головне ж, що вона мала б ловити: краулер, який збігся з ІМЕНОВАНОЮ групою,
 * ігнорує `User-agent: *` цілком. Пропущений там `Disallow` не «наслідується»,
 * а ВІДКРИВАЄ шлях саме названому боту. У чотирьох майже однакових блоках
 * очима цього не видно — тут це рядок звіту.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Агенти, від яких залежить видимість у відповідях AI (SEO-v8 § 7.2). */
export const SEARCH_AGENTS = ['OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot'];

/**
 * Групи `robots.txt` у порядку появи.
 *
 * Кілька `User-agent` підряд утворюють ОДНУ групу — це не деталь формату, а
 * єдиний спосіб не порахувати другого агента групою без правил.
 */
export function parseRobots(text) {
	const groups = [];
	let current = null;
	let lastWasAgent = false;

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.replace(/#.*$/, '').trim();
		if (!line) continue;
		const idx = line.indexOf(':');
		if (idx === -1) continue;
		const key = line.slice(0, idx).trim().toLowerCase();
		const value = line.slice(idx + 1).trim();

		if (key === 'user-agent') {
			if (!current || !lastWasAgent) {
				current = { agents: [], allow: [], disallow: [] };
				groups.push(current);
			}
			current.agents.push(value.toLowerCase());
			lastWasAgent = true;
			continue;
		}
		lastWasAgent = false;
		if (!current) continue;
		if (key === 'allow') current.allow.push(value);
		if (key === 'disallow') current.disallow.push(value);
	}
	return groups;
}

/**
 * @param {string} buildDir каталог зібраного сайту
 * @param {{ expectsLlmsTxt?: boolean, searchAgents?: string[] }} options
 * @returns {string[]} перелік проблем; порожній — усе гаразд
 */
export function checkGeo(buildDir, options = {}) {
	const { expectsLlmsTxt = true, searchAgents = SEARCH_AGENTS } = options;
	const problems = [];

	// --- llms.txt (§ 7.1) ---
	const llmsPath = join(buildDir, 'llms.txt');
	if (!existsSync(llmsPath)) {
		// Без поблажки «немає файлу — немає перевірки»: відсутність — це або
		// рішення (і тоді прапорець стоїть у false), або дефект. Мовчазний
		// третій варіант робив перевірку опційною й тому марною.
		if (expectsLlmsTxt) problems.push('llms.txt: файл відсутній у зібраному сайті');
	} else {
		const llms = readFileSync(llmsPath, 'utf8');
		if (!llms.startsWith('# ')) problems.push('llms.txt: немає заголовка H1');

		const urls = [...llms.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);
		if (urls.length === 0) problems.push('llms.txt: немає абсолютних посилань');

		// Та сама адреса під різними назвами: модель прочитає це як кілька
		// сторінок і назве користувачеві ті, яких не існує. Файл, написаний
		// проти галюцинацій, у такому вигляді сам їх і постачає.
		const dupes = [...new Set(urls.filter((u, i) => urls.indexOf(u) !== i))];
		if (dupes.length) {
			problems.push(`llms.txt: одна адреса під різними назвами: ${dupes.join(', ')}`);
		}
	}

	// --- robots.txt (§ 7.2) ---
	const robotsPath = join(buildDir, 'robots.txt');
	if (!existsSync(robotsPath)) {
		problems.push('robots.txt: файл відсутній у зібраному сайті');
		return problems;
	}

	const groups = parseRobots(readFileSync(robotsPath, 'utf8'));
	const star = groups.find((g) => g.agents.includes('*'));
	if (!star) problems.push('robots.txt: немає групи User-agent: *');

	for (const agent of searchAgents) {
		const group = groups.find((g) => g.agents.includes(agent.toLowerCase()));
		if (!group) {
			problems.push(`robots.txt: немає групи для ${agent}`);
			continue;
		}
		if (group.disallow.includes('/')) {
			problems.push(`robots.txt: ${agent} заблокований цілком (Disallow: /)`);
		}
		for (const path of star?.disallow ?? []) {
			if (!group.disallow.includes(path)) {
				problems.push(
					`robots.txt: ${agent} не успадкує "Disallow: ${path}" з * — повторіть рядок у його групі`
				);
			}
		}
	}

	return problems;
}
