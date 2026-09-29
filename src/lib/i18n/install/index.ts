/**
 * Словник вікна «На весь екран» — ДОВАНТАЖУЄТЬСЯ.
 *
 * Той самий прийом і та сама причина, що в `i18n/awaited/index.ts`: головний словник
 * імпортує всі чотири мови статично, тобто вони лежать у першому payload КОЖНОГО
 * відвідувача, а кнопка стоїть у шапці кореневого layout, бюджет якого вичерпано.
 *
 * ЦІНА НАЗВАНА: паритет цих ключів не стереже `check:i18n` — він звіряє зібрані
 * словники. Замість нього це робить `src/i18n-install.test.ts`.
 */

const loaded = new Map<string, Record<string, string>>();

/** Словник для мови. Порожній — невідома мова, і тоді ключ видно на екрані. */
export async function loadInstallText(locale: string): Promise<Record<string, string>> {
	const cached = loaded.get(locale);
	if (cached) return cached;

	/*
	 * Явний `switch`, а не `import(`./${locale}.ts`)`: динамічний імпорт зі змінною
	 * змушує збирач покласти в бандл ВСІ файли, що підходять під шаблон.
	 */
	let dict: Record<string, string> = {};
	switch (locale) {
		case 'uk':
			dict = (await import('./uk')).install;
			break;
		case 'en':
			dict = (await import('./en')).install;
			break;
		case 'de':
			dict = (await import('./de')).install;
			break;
		case 'nl':
			dict = (await import('./nl')).install;
			break;
	}

	loaded.set(locale, dict);
	return dict;
}
