import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { as, closeAll, peek, signedIn, type Connection } from './emulatorSession';

/**
 * ОСОБА — ЛИШЕ ПРИВʼЯЗАНОМУ АКАУНТУ, над справжніми правилами й SDK (аудит 2026-09-25).
 *
 * Правило бази тепер дивиться, чим людина ввійшла: профіль, псевдонім, пошук,
 * підписки й таблицю лідерів анонімному входу не пише. Гейт `check-rules.mjs`
 * доводить відмову, але не доводить головного для людини: що після привʼязки пошти
 * ТОЙ САМИЙ `uid` одразу може записати профіль. Для цього токен має стати
 * неанонімним ще до першого запису (`freshToken` у `net/account.ts`), і перевірити
 * це можна лише справжнім SDK: підставка не має ні токенів, ні правил.
 *
 * Зворотні експерименти (2026-09-26): зняти умову з УСІХ вузлів особи — червоніє
 * перше твердження («анонімний вхід»). Лише з профілю — зелено, і це правильно:
 * `saveProfile` пише профіль разом із псевдонімом одним записом, а псевдонім аноніма
 * однаково не пускає; окремі умови перевіряє гейт `check-rules.mjs`. Прибрати
 * `freshToken` із `linkEmail` — теж зелено: SDK оновлює токен при привʼязці й сам,
 * а виклик лишено як страховку, що не залежить від порядку всередині SDK.
 */

vi.mock('$lib/net/firebase', async () => {
	const { currentConnection } = await import('$lib/net/emulatorSession');
	return { connect: currentConnection, forget: () => {} };
});

let guest: Connection;

beforeAll(async () => {
	guest = await signedIn('identity-guest');
});

afterAll(() => closeAll([guest]));

describe('особа й вхід', () => {
	it('анонім профілю не пише, а щойно привʼязав пошту — пише тим самим uid', async () => {
		const account = await import('./account');
		const handle = `id_${Date.now() % 1_000_000_000}`;
		const profile = { name: 'Гість', handle };

		await expect(
			as(guest, () => account.saveProfile(profile, undefined, true)),
			'анонімний вхід'
		).rejects.toThrow(/permission/i);

		await as(guest, () =>
			account.linkEmail(`identity-${Date.now()}@example.test`, 'emulator-only')
		);
		await as(guest, () => account.saveProfile(profile, undefined, true));

		expect(await peek(guest, `users/${guest.uid}/profile/handle`)).toBe(handle);
		expect(await peek(guest, `handles/${handle}`)).toBe(guest.uid);
	});
});
