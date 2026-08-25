/**
 * Словник сповіщення «вас чекають у грі» — ДОВАНТАЖУЄТЬСЯ.
 *
 * Той самий приймо й та сама причина, що в `i18n/quiz/index.ts`: головний словник
 * імпортує всі чотири мови статично, тобто вони лежать у першому payload КОЖНОГО
 * відвідувача, а кореневий layout уже стоїть рівно на бюджеті.
 *
 * ЦІНА НАЗВАНА: паритет цих ключів не стереже `check:i18n` — він звіряє зібрані
 * словники. Замість нього це робить `src/i18n-awaited.test.ts`.
 */

const loaded = new Map<string, Record<string, string>>();

/** Словник для мови. Порожній — невідома мова, і тоді ключ видно на екрані. */
export async function loadAwaitedText(locale: string): Promise<Record<string, string>> {
	const cached = loaded.get(locale);
	if (cached) return cached;

	/*
	 * Явний `switch`, а не `import(`./${locale}.ts`)`: динамічний імпорт зі змінною
	 * змушує збирач покласти в бандл ВСІ файли, що підходять під шаблон.
	 */
	let dict: Record<string, string> = {};
	switch (locale) {
		case 'uk':
			dict = (await import('./uk')).awaited;
			break;
		case 'en':
			dict = (await import('./en')).awaited;
			break;
		case 'de':
			dict = (await import('./de')).awaited;
			break;
		case 'nl':
			dict = (await import('./nl')).awaited;
			break;
	}

	loaded.set(locale, dict);
	return dict;
}
