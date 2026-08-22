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
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

/** Усі .html у зібраному сайті. */
function htmlFiles(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) htmlFiles(full, out);
		else if (entry.endsWith('.html')) out.push(full);
	}
	return out;
}

/**
 * @param {string} buildDir каталог зібраного сайту
 * @param {{ expectsLlmsTxt?: boolean, searchAgents?: string[], robotsMeta?: boolean, spaFallback?: boolean }} options
 * @returns {string[]} перелік проблем; порожній — усе гаразд
 */
export function checkGeo(buildDir, options = {}) {
	const {
		expectsLlmsTxt = true,
		searchAgents = SEARCH_AGENTS,
		robotsMeta = true,
		// `true` для профілю, де `adapter-static` віддає фолбек на всі адреси:
		// власного HTML у маршруту там немає за побудовою.
		spaFallback = false
	} = options;
	const problems = [];

	// --- рівно ОДИН <meta name="robots"> на сторінку (§ 7.3) ---
	//
	// `<svelte:head>` ДОПИСУЄ до `<head>`, а не заміщує в ньому. Тег в
	// `app.html` і тег зі сторінки співіснують, і два теги з протилежним
	// змістом («index, follow» і «noindex») — це не помилка збірки й не
	// попередження: що переможе, вирішує краулер. Саме так `noindex` службової
	// сторінки одного разу вже поїхав у прод разом із дозволом на індексацію.
	if (robotsMeta) {
		for (const file of htmlFiles(buildDir)) {
			const tags = readFileSync(file, 'utf8').match(/<meta[^>]+name="robots"/g) ?? [];
			if (tags.length > 1) {
				const rel = file.split(/[\\/]/).join('/');
				problems.push(`${rel}: <meta name="robots"> знайдено ${tags.length} разів, очікується 1`);
			}
		}
	}

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

		// Кожна ВЛАСНА адреса мусить існувати в `build/`.
		//
		// Дублікат — це коли сторінку назвали двічі; тут гірше: сторінки немає
		// зовсім, і модель віддає користувачеві посилання на 404. Корінь сайту
		// береться з `canonical` головної, а не з константи, щоб перевірка не
		// потребувала налаштування й не розходилася з тим, що справді зібрано.
		//
		// На сайтах із SPA-фолбеком (`adapter-static` із `fallback`) перевірка
		// вимкнена прапорцем: там власного HTML у маршруту немає за побудовою,
		// сервер віддає фолбек, і адреса працює. Вмикати її там означало б
		// позначати справні сторінки як неіснуючі.
		const home = join(buildDir, 'index.html');
		const siteUrl = existsSync(home)
			? (readFileSync(home, 'utf8').match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1] ??
				'')
			: '';
		if (spaFallback) {
			// нічого: адресу обслуговує фолбек, файлу для неї не існує й не має існувати
		} else if (!siteUrl) {
			problems.push('llms.txt: не вдалося знайти canonical головної — адреси нема з чим звіряти');
		} else {
			const root = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
			const isFile = (p) => existsSync(p) && statSync(p).isFile();
			for (const url of new Set(urls)) {
				// Чужі домени (репозиторій, соцмережі) не наша відповідальність.
				if (!url.startsWith(root)) continue;
				const rel = url
					.slice(root.length)
					.replace(/[?#].*$/, '')
					.replace(/\/$/, '');
				// `isFile`, а не `existsSync`: каталог `departments/` існує через
				// підсторінки, але сторінки `/departments` при цьому немає, і
				// саме таке посилання вже стояло в одному з файлів.
				const exists =
					rel === ''
						? true
						: isFile(join(buildDir, rel, 'index.html')) ||
							isFile(join(buildDir, `${rel}.html`)) ||
							isFile(join(buildDir, rel));
				if (!exists) problems.push(`llms.txt: адреси немає в build/ — ${url}`);
			}
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
