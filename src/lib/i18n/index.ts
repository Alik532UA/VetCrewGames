import { uk, type LazyTranslationKey, type TranslationKey } from './translations/uk';
import { lazyText } from './lazyText.svelte';
import { en } from './translations/en';
import { de } from './translations/de';
import { nl } from './translations/nl';
import { settings } from '$lib/services/settings.svelte';

/**
 * `Record<TranslationKey, string>` — це і є контракт повноти: словник, у якому
 * бракує ключа, не збереться. Українська тут еталон, бо саме з неї писалося
 * все інше.
 *
 * Ключі СПІВПАДАЮТЬ, а тексти ні — і перевіряти треба саме перше. Тому крім
 * цього типу є `src/i18n-completeness.test.ts`: тип бачить лише те, що зібрано
 * в об'єкт, а тест іде від оголошених мов до файлів на диску й ловить
 * протилежне — мову, обіцяну в `LANGUAGES`, у якої словника немає.
 */
/**
 * Контракт повноти НЕ поширюється на ліниві ключі: їх у зібраному словнику немає
 * за побудовою — вони приїжджають окремим чанком (`i18n/reserve`). Паритет тих
 * ключів між мовами стереже `src/i18n-reserve.test.ts`, бо `check:i18n` звіряє
 * саме зібрані словники й після виносу їх більше не бачить.
 */
type Translations = Record<Exclude<TranslationKey, LazyTranslationKey>, string>;

const translations: Record<string, Translations> = {
	uk,
	en,
	de,
	nl
};

/**
 * ДОДАТИ ДОВАНТАЖЕНІ РЯДКИ у той самий реєстр, з якого читає `t()`.
 *
 * Прийом інший, ніж у `i18n/quiz` та `i18n/account`, і причина названа в
 * `i18n/reserve/index.ts`: ті словники читають один-два екрани, і перекладач
 * туди приходить пропом. Заповідник читають двадцять чотири компоненти в пʼять
 * рівнів завглибшки — проп довелося б протягнути через кожен.
 *
 * Реєстр при цьому лишається звичайним обʼєктом, а сигнал «словник змінився»
 * живе окремою руною (`lazyText`): рун у цьому файлі бути не може, бо його
 * читають і юніт-тести під `environment: node`.
 */
export function addTranslations(locale: string, dict: Record<string, string>): void {
	const target = translations[locale] as Record<string, string> | undefined;
	if (!target) return;
	Object.assign(target, dict);
	lazyText.bump();
}

export const t = (key: TranslationKey): string => {
	/*
	 * Читання версії робить КОЖЕН виклик залежним від довантаження: без цього
	 * рядка компонент, намальований до приїзду чанку, лишився б із ключем на
	 * екрані назавжди — руна `settings.locale` міняється лише при зміні мови.
	 */
	void lazyText.version;
	const dict = translations[settings.locale] as Record<string, string> | undefined;
	return dict?.[key] ?? key;
};

/** For dynamic keys from data (e.g. animal names, facts) */
export const td = (key: string): string => {
	void lazyText.version;
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

/**
 * Чисельність популяції словами: «~33 млрд», «~1,2 млн».
 *
 * Живе тут, а не в сторінці гри, з двох причин. Перша: це форматування ЧИСЛА
 * під поточну мову — рівно те, чим займається i18n, і `toLocaleString` тут
 * отримує локаль явно (I18N-v8 § 4.3). Друга: результат іде в `{@html}`, а
 * інваріант у `src/security.test.ts` вимагає, щоб туди потрапляв лише
 * результат форматерів словника — page-локальна функція під це не підпадала
 * і робила перевірку слабшою.
 */
export const formatPopulation = (value: number): string => {
	const locale = settings.locale;
	if (value >= 1_000_000_000_000)
		return formatFont(`~${value / 1_000_000_000_000} ${t('unit.trillion')}`);
	if (value >= 1_000_000_000) return formatFont(`~${value / 1_000_000_000} ${t('unit.billion')}`);
	if (value >= 1_000_000) return formatFont(`~${value / 1_000_000} ${t('unit.million')}`);
	if (value >= 1_000) return formatFont(`~${value / 1_000} ${t('unit.thousand')}`);
	return formatFont(`~${value.toLocaleString(locale)}`);
};

export const formatPlain = (text: string): string => {
	if (settings.font !== 'inglobal') return text;
	return text.replace(/і/g, 'i').replace(/І/g, 'I');
};
