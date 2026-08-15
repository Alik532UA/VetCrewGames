import { uk, type TranslationKey } from './translations/uk';
import { en } from './translations/en';
import { settings } from '$lib/services/settings.svelte';

type Translations = Record<TranslationKey, string>;

const translations: Record<string, Translations> = {
	uk,
	en
};

export const t = (key: TranslationKey): string => {
	return translations[settings.locale]?.[key] ?? key;
};

/** For dynamic keys from data (e.g. animal names, facts) */
export const td = (key: string): string => {
	const dict = translations[settings.locale] as Record<string, string> | undefined;
	return dict?.[key] ?? key;
};

/*
 * Тут були `tp()` і `getPluralForm()` — власна арифметика плюралізації на
 * `n % 10` та `n % 100`. I18N-v8 § 4.2 забороняє її прямо (рівень HIGH):
 * ручні формули помиляються на 11–14 і на 111, а правильна відповідь уже є в
 * платформі — `Intl.PluralRules`.
 *
 * Обидві функції при цьому не викликалися ніде: жодного числа з множиною в
 * інтерфейсі немає, кількість раундів завжди «N / 10». Тобто це був
 * одночасно й анти-патерн, і мертвий код — а мертвий код читається як
 * зроблена робота (PROJECT-STRUCTURE-v8 § 4.3).
 *
 * Коли множина знадобиться, писати треба НЕ це:
 *   const rules = new Intl.PluralRules(settings.locale);
 *   rules.select(n);   // 'one' | 'few' | 'many' | 'other'
 */
export const formatFont = (text: string): string => {
	if (settings.font !== 'inglobal') return text;
	// Шрифт inglobal не містить українських літер 'і', 'ї', 'є', 'ґ'.
	// Тому ми замінюємо 'і' на латинську 'i', а для інших букв використовуємо fallback-шрифти.

	const format = (letter: string, isNoto: boolean, spaceBefore?: string, spaceAfter?: string) => {
		// Використовуємо display: inline та position: relative замість inline-block/transform.
		// Це КРИТИЧНО для того, щоб браузер не розривав слова при переносі рядків.
		// Також ми обгортаємо весь результат у зовнішній span (див. нижче), щоб уникнути
		// перетворення частин тексту на окремі flex-item у батьківських контейнерах.
		const styles = ['display: inline', 'position: relative'];
		if (isNoto) {
			styles.push('font-size: 0.95em');
		} else {
			styles.push('font-size: 0.9em', 'top: 0.06em');
		}

		if (spaceBefore) styles.push('margin-left: 0.15em');
		if (spaceAfter) styles.push('margin-right: 0.15em');

		const styleAttr = ` style="${styles.join('; ')};"`;
		const span = `<span class="${isNoto ? 'font-noto' : 'font-comfortaa'}"${styleAttr}>${letter}</span>`;
		return (spaceBefore ?? '') + span + (spaceAfter ?? '');
	};

	const res = text
		.replace(/і/g, 'i')
		.replace(/І/g, 'I')
		.replace(/(\s)?(є|Є)(\s)?/g, (match, b, l, a) => format(l, true, b, a))
		.replace(/(\s)?(ї|Ї|ґ|Ґ)(\s)?/g, (match, b, l, a) => format(l, false, b, a));

	// Обгортаємо весь результат у span з display: inline.
	// Якщо батьківський елемент - flex-контейнер, він побачить лише один flex-item,
	// і текст всередині нього буде переноситися по словах згідно з правилами мови.
	return `<span style="display: inline;">${res}</span>`;
};

export const formatPlain = (text: string): string => {
	if (settings.font !== 'inglobal') return text;
	return text.replace(/і/g, 'i').replace(/І/g, 'I');
};
