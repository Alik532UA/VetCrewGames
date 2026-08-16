import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: false }));

const { settings } = await import('./settings.svelte');

/**
 * Володіння шапкою під час переходу між сторінками.
 *
 * Svelte монтує НОВУ сторінку раніше, ніж знищує стару. Тобто прибирання
 * завжди приходить після того, як наступник уже все поставив, — і сторінка, що
 * йде, чистить чужу шапку, а не свою.
 *
 * Порівняння за ключем цього не ловить. «Де живем?» має три сторінки — вибір
 * режиму й дві гри — і всі три ставлять `habitat.title`: стара бачила свій ключ
 * на місці (його щойно поставила нова) і чесно стирала. Заголовок ставав
 * `null`, шапка вважала сторінку головною й ховала «назад».
 *
 * Побачив це користувач, і побачив рівно так: прямий захід за адресою працює,
 * перехід із меню — ні. Різниця в тому, що при прямому заході старої сторінки
 * просто немає.
 */
describe('володіння шапкою', () => {
	it('перевірка жива: спочатку шапка нічия', () => {
		settings.claimHeader('app.title')();
		expect(settings.headerTitleKey).toBeNull();
	});

	it('заголовок і крок назад стають на місце', () => {
		const back = () => {};
		const release = settings.claimHeader('habitat.title', back);

		expect(settings.headerTitleKey).toBe('habitat.title');
		expect(settings.headerBack).toBe(back);

		release();
		expect(settings.headerTitleKey).toBeNull();
		expect(settings.headerBack).toBeNull();
	});

	/** Той самий ключ у двох сторінок — саме той випадок, що й ламався. */
	it('стара сторінка не забирає шапку в нової з тим самим ключем', () => {
		const releaseOld = settings.claimHeader('habitat.title');
		const releaseNew = settings.claimHeader('habitat.title', () => {});

		// Порядок життєвого циклу: нова вже змонтувалася, стара аж тепер іде.
		releaseOld();

		expect(settings.headerTitleKey, 'заголовок стерла чужа сторінка').toBe('habitat.title');
		expect(settings.headerBack, 'крок назад стерла чужа сторінка').not.toBeNull();

		releaseNew();
		expect(settings.headerTitleKey).toBeNull();
	});

	it('різні ключі поводяться так само', () => {
		const releaseOld = settings.claimHeader('habitat.title');
		settings.claimHeader('memory.title');
		releaseOld();

		expect(settings.headerTitleKey).toBe('memory.title');
		settings.claimHeader('app.title')();
	});

	it('повторне звільнення нічого не ламає', () => {
		const release = settings.claimHeader('family.title');
		release();
		settings.claimHeader('feeding.title');
		release(); // друге спрацювання вже нічиє

		expect(settings.headerTitleKey, 'звільнення спрацювало вдруге').toBe('feeding.title');
		settings.claimHeader('app.title')();
	});
});
