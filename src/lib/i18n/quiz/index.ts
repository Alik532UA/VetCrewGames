/**
 * Словник спільної вікторини — ДОВАНТАЖУЄТЬСЯ.
 *
 * Той самий приймо й та сама причина, що в `i18n/account/index.ts`, і причина
 * заміряна: `i18n/index.ts` імпортує всі чотири мови статично, тобто вони лежать
 * у бандлі кореневого layout — у першому payload КОЖНОГО відвідувача. Одинадцять
 * рядків на мову коштували 0,5 КБ gzip і перевищили бюджет (120,5 проти 120)
 * заради кімнати, у яку зайде далеко не кожен.
 *
 * ЦІНА НАЗВАНА: паритет цих ключів більше не стереже `check:i18n` — він звіряє
 * зібрані словники. Замість нього це робить `src/i18n-quiz.test.ts`.
 */

const loaded = new Map<string, Record<string, string>>();

/**
 * Словник для мови. Порожній — невідома мова, і тоді ключ видно на екрані.
 *
 * Віддається САМ СЛОВНИК, а не готова функція-перекладач: сторінка тримає
 * результат у `$state`, а функція в `$state` не оновлювала екран — рядки
 * лишалися ключами, хоч словник і приїхав (заміряно в браузері на сторінці
 * акаунта). Звичайний обʼєкт реактивний як усе інше, а перекладач із нього
 * виводиться `$derived`.
 */
export async function loadQuizText(locale: string): Promise<Record<string, string>> {
	const cached = loaded.get(locale);
	if (cached) return cached;

	/*
	 * Явний `switch`, а не `import(`./${locale}.ts`)`: динамічний імпорт зі
	 * змінною змушує збирач покласти в бандл ВСІ файли, що підходять під шаблон, —
	 * тобто рівно те, від чого ми тут ідемо.
	 */
	let dict: Record<string, string> = {};
	switch (locale) {
		case 'uk':
			dict = (await import('./uk')).quiz;
			break;
		case 'en':
			dict = (await import('./en')).quiz;
			break;
		case 'de':
			dict = (await import('./de')).quiz;
			break;
		case 'nl':
			dict = (await import('./nl')).quiz;
			break;
	}

	loaded.set(locale, dict);
	return dict;
}
