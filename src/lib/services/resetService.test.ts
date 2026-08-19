// @vitest-environment node
// Читає файли проєкту й підставляє вікно сам — DOM не потрібен.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Аварійне скидання: що воно стирає, і що станеться, коли проєкт зміниться.
 *
 * Перевірки тут переважно СТРУКТУРНІ, і це не лінь. Сам `hardReset` наприкінці
 * кличе `window.location.reload()`, тобто повний прогін у jsdom або нічого не
 * робить, або валить оточення тесту; а головні властивості цього коду — «стирає
 * лише своє» й «знає про все, що треба стерти» — читаються з джерел точніше, ніж
 * із поведінки мока.
 */
const SOURCE = 'src/lib/services/resetService.ts';
const source = readFileSync(SOURCE, 'utf8');
/**
 * Код без комментарів.
 *
 * Потрібно, бо докблок цитує `localStorage.clear()` саме як опис того, чого
 * робити НЕ можна — і перевірка «прямого clear() немає» ловила б цю цитату.
 * Той самий прийом уже стоїть у перевірках правил бази.
 */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('аварійне скидання', () => {
	it('перевірка жива: файл знайдено', () => {
		expect(source).toContain('export async function hardReset');
	});

	it('стирає лише СВОЄ: через фасад, а не через сховище напряму', () => {
		/*
		 * Origin спільний із сусідніми проєктами на GitHub Pages, тож
		 * `localStorage.clear()` знищив би чужі дані. Фасад видаляє лише ключі з
		 * префіксом `vetcrewgames_` (STORAGE-NAMESPACE-v8 § 2).
		 */
		expect(code, 'сховище чиститься фасадом').toMatch(/\bstorage\.clear\(\)/);
		expect(code, 'сесійне сховище теж').toMatch(/\bsessionStore\.clear\(\)/);
		expect(code, 'прямий clear() знищив би дані сусідів').not.toMatch(
			/localStorage\.clear\(\)|sessionStorage\.clear\(\)/
		);
	});

	it('кукі стираються лише свого шляху', () => {
		// Без `path`, що збігається з поставленим, запис не видаляється, а дублюється.
		expect(source).toMatch(/path=\$\{path\}/);
		expect(source).toMatch(/base \|\| '\/'/);
	});

	it('у проді підтвердження обов’язкове (два незалежні бар’єри)', () => {
		expect(source, 'діалог мусить бути').toMatch(/window\.confirm\(/);
		expect(source, 'поріг проду мусить бути іншим за dev').toMatch(/RESET_PRESSES_PROD/);
	});

	it('пороги: 5 у dev, 55 у проді', async () => {
		const { RESET_PRESSES_DEV, RESET_PRESSES_PROD } = await import('./resetService');
		// Ціна випадкового спрацювання — увесь місцевий прогрес.
		expect(RESET_PRESSES_DEV).toBe(5);
		expect(RESET_PRESSES_PROD).toBe(55);
	});

	it('текст підтвердження НЕ через i18n — і це записано', () => {
		/*
		 * `confirm()` може знадобитися саме тоді, коли зламалося завантаження
		 * словників: `t()` віддав би ключ, тобто людина побачила б «reset.confirm»
		 * перед знищенням прогресу. Виняток свідомий, і причина стоїть у файлі.
		 */
		expect(source, 'i18n у діалозі скидання — пастка').not.toMatch(/\bt\(['"]/);
		expect(source, 'виняток мусить бути обґрунтований у самому файлі').toMatch(/i18n/);
	});

	it('кеші стираються — і ЛИШЕ свої, за префіксом', () => {
		/*
		 * PWA тут ще немає, тож сьогодні цей код не робить нічого. Написаний він
		 * заздалегідь навмисно: `caches.keys()` віддає імена кешів усього ORIGIN, і
		 * дописувати фільтр у поспіху, коли PWA вже приїхала, — це рівно той спосіб,
		 * яким скидання перетворюється на «стерти все, що є на домені».
		 */
		expect(code, 'кеші мусять чиститися').toMatch(/caches\.keys\(\)/);
		expect(code, 'фільтр за префіксом проєкту — обовʼязковий').toMatch(
			/startsWith\(PREFIX\)/
		);
		expect(code, 'префікс мусить бути з ОДНОГО джерела зі сховищем').toMatch(
			/from '\.\/storage'/
		);
		// Видалення без фільтра — саме те, чого тут не має бути.
		expect(code, 'жодного delete по всіх іменах').not.toMatch(
			/names\.map\(|keys\.map\(\s*\(?name\)?\s*=>\s*caches\.delete/
		);
	});

	it('реєстрації service worker знімаються — і ЛИШЕ свої, за scope', () => {
		/*
		 * Найважливіша перевірка цього файлу, і вона про чужі дані.
		 *
		 * `getRegistrations()` віддає реєстрації всього ORIGIN. `Slovko` проходить по
		 * всіх і знімає кожну — тобто одне натискання `r` там вбиває service worker
		 * MindStep і будь-якого іншого проєкту на `alik532ua.github.io`. Тут scope
		 * мусить лежати всередині `base`.
		 *
		 * Порівняння саме як АДРЕСИ: `scope` завжди абсолютний
		 * (`https://host/VetCrewGames/`), а `base` — шлях (`/VetCrewGames`), тож пряме
		 * `startsWith(base)` не збіглося б ніколи й фільтр тихо відкинув би все.
		 */
		expect(code, 'реєстрації мусять зніматися').toMatch(/getRegistrations\(\)/);
		expect(code, 'фільтр за scope — обовʼязковий').toMatch(
			/registration\.scope\.startsWith\(scopePrefix\)/
		);
		expect(code, 'scope порівнюється як адреса, а не як шлях').toMatch(
			/new URL\(`\$\{base \|\| ''\}\/`, window\.location\.origin\)/
		);
	});

	it('кожна половина під власним try: збій однієї не скасовує решту', () => {
		// Спільний `try` означав би: не вдалося стерти кукі — і кеші лишилися.
		// Скидання кличуть, коли вже зламано, тож воно робить стільки, скільки може.
		const tries = (code.match(/(?:^|\s)try\s*\{/g) ?? []).length;
		expect(tries, 'try мусить бути кілька, а не один на все').toBeGreaterThanOrEqual(4);
	});

	it('обидві половини під перевіркою наявності — сьогодні вони no-op', () => {
		// Проєкт ще без PWA. Без цих guard-ів код кидав би на кожному скиданні.
		expect(code).toMatch(/'caches' in window/);
		expect(code).toMatch(/'serviceWorker' in navigator/);
	});
});
