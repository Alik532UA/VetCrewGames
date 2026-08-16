import type { TranslationKey } from '$lib/i18n/translations/uk';

/**
 * Теми сайту: перелік і підпис до кожної.
 *
 * Тут, а не в `settings`, з двох причин. Перша — це дані, а `settings` про
 * роботу зі сховищем і застосування вибраного. Друга практична: імпорт
 * `settings` піднімає синглтон, який лізе в DOM, тож звірити перелік у тесті
 * без браузера було б неможливо.
 *
 * ЗНАЧКІВ тут немає навмисно, хоч вони й здаються частиною опису теми: вони
 * тягнуть за собою `lucide-svelte`, а через `settings` — і в кожен тест, що
 * бере налаштування. Перший підхід саме на цьому й завалив набір: тести
 * налаштувань вичерпували п'ять секунд на імпорті бібліотеки значків. Значок
 * живе там, де малюється, і повнота того переліку забезпечена типом.
 *
 * Порядок — той, у якому пункти стоять у меню: першою та, у якій сайт
 * відкривається, решта до неї альтернативи.
 */
export interface ThemeOption {
	id: string;
	labelKey: TranslationKey;
}

export const THEME_OPTIONS = [
	{ id: 'dark', labelKey: 'theme.dark' },
	{ id: 'light-green', labelKey: 'theme.light-green' },
	{ id: 'winter', labelKey: 'theme.winter' },
	{ id: 'orange-purple', labelKey: 'theme.orange-purple' }
] as const satisfies readonly ThemeOption[];

/**
 * Тема — це рівно один із пунктів переліку, і тип виводиться з нього.
 *
 * Так тему НЕ МОЖНА завести повз меню. Доти перелік тем жив у `settings`
 * окремим масивом, а пункти меню — окремим списком у розмітці; тема, дописана
 * лише в один із них, працювала б і зберігалася, але вибрати її не було б чим,
 * і не сказав би про це ніхто.
 */
export type Theme = (typeof THEME_OPTIONS)[number]['id'];

/** Усі теми сайту — рівно ті, що є в переліку. */
export const THEMES: readonly Theme[] = THEME_OPTIONS.map((option) => option.id);
