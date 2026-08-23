import type { Translate } from '$lib/config/crewNames';

/**
 * Словник сторінки акаунта — ДОВАНТАЖУЄТЬСЯ.
 *
 * Причина та сама, що в `i18n/crew/index.ts`, і вона заміряна: `i18n/index.ts`
 * імпортує всі чотири мови статично, тобто вони лежать у бандлі кореневого
 * layout — у першому payload КОЖНОГО відвідувача. Двадцять вісім рядків на мову
 * додали 2 КБ gzip і перевищили бюджет (122 проти 120) заради сторінки, яку
 * відкриє далеко не кожен.
 *
 * Правильний хід тут — не підняти бюджет (борг у цьому проєкті лише
 * зменшується), а винести дані туди, де вони потрібні.
 *
 * ЦІНА НАЗВАНА: паритет цих ключів більше не стереже `check:i18n` — він звіряє
 * зібрані словники. Замість нього це робить `src/i18n-account.test.ts`, який
 * імпортує всі чотири файли й падає і на бракуючому рядку, і на зайвому.
 */

const loaded = new Map<string, Record<string, string>>();

/** Порожній словник для невідомої мови: ключ на екрані видно одразу. */
export async function loadAccountText(locale: string): Promise<Translate> {
	const cached = loaded.get(locale);
	if (cached) return (key: string) => cached[key] ?? key;

	/*
	 * Явний `switch`, а не `import(\`./${locale}.ts\`)`: динамічний імпорт зі
	 * змінною змушує збирач покласти в бандл ВСІ файли, що підходять під шаблон, —
	 * тобто рівно те, від чого ми тут ідемо.
	 */
	let dict: Record<string, string> = {};
	switch (locale) {
		case 'uk':
			dict = (await import('./uk')).account;
			break;
		case 'en':
			dict = (await import('./en')).account;
			break;
		case 'de':
			dict = (await import('./de')).account;
			break;
		case 'nl':
			dict = (await import('./nl')).account;
			break;
	}

	loaded.set(locale, dict);
	return (key: string) => dict[key] ?? key;
}
