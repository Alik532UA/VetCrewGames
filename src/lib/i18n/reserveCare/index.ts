/**
 * Словник вибору «найняти / зробити самому» — ДОВАНТАЖУЄТЬСЯ.
 *
 * Той самий прийом і та сама причина, що в `i18n/quiz/index.ts`: головний
 * словник імпортує всі чотири мови статично, тобто вони лежать у першому payload
 * КОЖНОГО відвідувача. Тринадцять рядків на мову коштували кілобайт gzip і
 * перевищили бюджет кореневого layout (123 проти 122) заради вікна, яке побачить
 * лише той, хто дійшов до заповідника й лишився без працівника.
 *
 * ЦІНА НАЗВАНА: паритет цих ключів більше не стереже `check:i18n` — він звіряє
 * зібрані словники. Замість нього це робить `src/i18n-reserve-care.test.ts`.
 */

const loaded = new Map<string, Record<string, string>>();

/** Словник для мови. Порожній — невідома мова, і тоді ключ видно на екрані. */
export async function loadReserveCareText(locale: string): Promise<Record<string, string>> {
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
			dict = (await import('./uk')).reserveCare;
			break;
		case 'en':
			dict = (await import('./en')).reserveCare;
			break;
		case 'de':
			dict = (await import('./de')).reserveCare;
			break;
		case 'nl':
			dict = (await import('./nl')).reserveCare;
			break;
	}

	loaded.set(locale, dict);
	return dict;
}
