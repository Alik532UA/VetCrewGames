import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnRoom } from '$lib/net/ownRooms';
import type { RoomInfo } from '$lib/net/roomTypes';

/**
 * «Вас чекають у грі»: контролер смуги, яка живе поза сторінкою партії.
 *
 * ## Чому цей файл зʼявився пізніше за сам контролер
 *
 * Покриття контролерів тут 87%, і рівно один із них мав НУЛЬ — цей. Перевірка
 * поруч була (`src/awaited-room.test.ts`), але вона читає ТЕКСТ файлу: чи
 * згадано `othersPresent`, чи є `watchOthers(code`. Такий гейт ловить видалення
 * рядка й не каже нічого про поведінку — зокрема про те, заради чого весь клас
 * і написаний: що станеться, коли відповідь приїде ПІСЛЯ того, як її перестали
 * чекати.
 *
 * ## Що тут головне
 *
 * Кожен шлях контролера їде через `await`: два динамічні імпорти, читання
 * приватного індексу, запит присутності, вхід у базу. Тобто «смугу закрили» і
 * «підписка встановилася» — дві події без гарантованого порядку, і саме на
 * їхньому перетині живуть обидва дефекти, які тут закріплені: підписка, що
 * пережила власне зняття, і запис старої відповіді поверх нової.
 *
 * Мережа підмінена на межі модуля — так само, як у `lobbyFeed.svelte.test.ts`:
 * `net/ownRooms`, `net/presence` і `net/rtdbRoom` тягнуться ДИНАМІЧНИМ імпортом,
 * і передати їм іншу реалізацію нікуди.
 */

const NOW = 1_700_000_000_000;

const own = (over: Partial<OwnRoom> = {}): OwnRoom => ({
	code: 'AAAAA',
	gameId: 'pairs',
	status: 'playing',
	hostUid: 'uid-host',
	amHost: false,
	aliveAt: NOW,
	...over
});

const listOwnRooms = vi.fn<() => Promise<OwnRoom[]>>(async () => []);
const forgetOwnRoom = vi.fn<(code: string) => Promise<void>>(async () => {});
const othersPresent = vi.fn<(code: string) => Promise<number>>(async () => 1);
const leaveRoom = vi.fn<(code: string) => Promise<void>>(async () => {});

/** Знята підписка — за кодом кімнати, щоб було видно, чию саме зняли. */
const stopInfo = vi.fn<(code: string) => void>();
const stopOthers = vi.fn<(code: string) => void>();

/** Останній callback кожної підписки: ним і «приїжджає» зміна з бази. */
const onInfoOf = new Map<string, (info: RoomInfo | null) => void>();
const onOthersOf = new Map<string, (others: number) => void>();

const watchRoomInfo = vi.fn(async (code: string, onInfo: (info: RoomInfo | null) => void) => {
	onInfoOf.set(code, onInfo);
	return () => stopInfo(code);
});
const watchOthers = vi.fn(async (code: string, onCount: (others: number) => void) => {
	onOthersOf.set(code, onCount);
	return () => stopOthers(code);
});

vi.mock('$lib/net/ownRooms', () => ({ listOwnRooms, forgetOwnRoom }));
vi.mock('$lib/net/presence', () => ({ othersPresent, watchOthers }));
vi.mock('$lib/net/rtdbRoom', () => ({ leaveRoom, watchRoomInfo }));

const { AwaitedRoom } = await import('./awaitedRoom.svelte');

/** Чекання «поки підписки встановляться»: усередині лише мікрозадачі. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Коди кімнат, чиї підписки зняті, — плоским списком із обох замикачок. */
const stopped = (calls: { mock: { calls: string[][] } }) => calls.mock.calls.flat();

describe('AwaitedRoom', () => {
	beforeEach(() => {
		listOwnRooms.mockReset().mockResolvedValue([]);
		forgetOwnRoom.mockReset().mockResolvedValue(undefined);
		othersPresent.mockReset().mockResolvedValue(1);
		leaveRoom.mockReset().mockResolvedValue(undefined);
		stopInfo.mockReset();
		stopOthers.mockReset();
		watchRoomInfo.mockClear();
		watchOthers.mockClear();
		onInfoOf.clear();
		onOthersOf.clear();
	});

	describe('кого показувати', () => {
		it('перевірка жива: без своїх кімнат смуги немає', async () => {
			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);
			expect(awaited.room).toBeNull();
			expect(watchRoomInfo).not.toHaveBeenCalled();
		});

		it('кімната з людьми показується й береться під нагляд', async () => {
			listOwnRooms.mockResolvedValue([own()]);
			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);
			await settle();

			expect(awaited.room?.code).toBe('AAAAA');
			expect(watchRoomInfo).toHaveBeenCalledWith('AAAAA', expect.any(Function));
			expect(watchOthers).toHaveBeenCalledWith('AAAAA', expect.any(Function));
		});

		/**
		 * Скарга автора, через яку зʼявився запит присутності: свіжий `aliveAt`
		 * лишає МОЄ власне серцебиття, а не чужа присутність.
		 */
		it('порожня кімната не чекає, хоч і виглядає свіжою', async () => {
			listOwnRooms.mockResolvedValue([own()]);
			othersPresent.mockResolvedValue(0);
			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);

			expect(awaited.room).toBeNull();
			expect(watchRoomInfo).not.toHaveBeenCalled();
		});

		it('кінець партії гасить смугу сам', async () => {
			listOwnRooms.mockResolvedValue([own()]);
			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);
			await settle();

			onInfoOf.get('AAAAA')?.({ status: 'over' } as RoomInfo);
			expect(awaited.room).toBeNull();
		});

		it('вихід останнього гасить смугу сам', async () => {
			listOwnRooms.mockResolvedValue([own()]);
			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);
			await settle();

			onOthersOf.get('AAAAA')?.(0);
			expect(awaited.room).toBeNull();
		});
	});

	/**
	 * ГОЛОВНЕ. Підписка приїжджає через два динамічні імпорти й вхід у базу, тож
	 * «смугу закрили» цілком може статися РАНІШЕ.
	 */
	describe('відповідь, яку вже не чекають', () => {
		/**
		 * ТОЙ САМИЙ ДЕФЕКТ У ЧИСТОМУ ВИГЛЯДІ.
		 *
		 * Замикачка присвоювалася в кінці шляху, тож `dismiss()` посередині бачив
		 * `null` і не знімав нічого — а підписка приїжджала після нього й жила
		 * далі. Щоб потрапити рівно в цю мить, вхід у базу тут тримається доти,
		 * доки смугу не закриють.
		 */
		it('підписка, що приїхала ПІСЛЯ закриття, знімається одразу', async () => {
			listOwnRooms.mockResolvedValue([own()]);
			let release: () => void = () => {};
			watchRoomInfo.mockImplementationOnce(
				(code: string) =>
					new Promise<() => void>((resolve) => {
						release = () => resolve(() => stopInfo(code));
					})
			);

			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);
			await settle(); // дійшли до входу в базу й зупинилися на ньому

			awaited.dismiss();
			release();
			await settle();

			expect(awaited.room).toBeNull();
			expect(stopped(stopInfo), 'підписка пережила власне закриття').toContain('AAAAA');
			expect(watchOthers, 'друга підписка відкрита вже після закриття').not.toHaveBeenCalled();
		});

		it('закриття ще до входу в базу не відкриває підписки взагалі', async () => {
			listOwnRooms.mockResolvedValue([own()]);
			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);

			// Ще до `settle()`: динамічні імпорти всередині нагляду не розвʼязалися.
			awaited.dismiss();
			await settle();

			expect(awaited.room).toBeNull();
			expect(watchRoomInfo).not.toHaveBeenCalled();
			expect(watchOthers).not.toHaveBeenCalled();
		});

		it('після закриття підписка вже нічого не пише', async () => {
			listOwnRooms.mockResolvedValue([own()]);
			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);
			await settle();
			awaited.dismiss();

			listOwnRooms.mockResolvedValue([own({ code: 'BBBBB' })]);
			await awaited.refresh(NOW);
			await settle();
			expect(awaited.room?.code).toBe('BBBBB');

			// Запізніла звістка зі СТАРОЇ кімнати не має права гасити нову смугу.
			onInfoOf.get('AAAAA')?.(null);
			onOthersOf.get('AAAAA')?.(0);
			expect(awaited.room?.code, 'стара підписка загасила чужу смугу').toBe('BBBBB');
		});

		it('перехід на іншу кімнату знімає нагляд за попередньою', async () => {
			listOwnRooms.mockResolvedValue([own()]);
			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);
			await settle();

			listOwnRooms.mockResolvedValue([own({ code: 'BBBBB' })]);
			await awaited.refresh(NOW);
			await settle();

			expect(stopped(stopInfo)).toContain('AAAAA');
			expect(stopped(stopOthers)).toContain('AAAAA');
			expect(stopped(stopInfo), 'зняли не ту кімнату').not.toContain('BBBBB');
		});

		/**
		 * Дві відповіді в дорозі одночасно: сторінка кличе `refresh()` на вході в
		 * застосунок і ще раз після переходу зі сторінки онлайну.
		 */
		it('повільніша відповідь не перебиває свіжішу', async () => {
			let releaseFirst: (rooms: OwnRoom[]) => void = () => {};
			listOwnRooms.mockImplementationOnce(
				() => new Promise<OwnRoom[]>((resolve) => (releaseFirst = resolve))
			);
			const awaited = new AwaitedRoom();
			const first = awaited.refresh(NOW);

			listOwnRooms.mockResolvedValue([]);
			await awaited.refresh(NOW);
			expect(awaited.room).toBeNull();

			// Перша відповідь приїжджає після другої — і мовчить.
			releaseFirst([own()]);
			await first;
			await settle();

			expect(awaited.room, 'застаріла відповідь записалася поверх свіжої').toBeNull();
			expect(watchRoomInfo, 'застаріла відповідь відкрила підписку').not.toHaveBeenCalled();
		});
	});

	describe('вихід із кімнати', () => {
		it('прибирає рядок складу, свій індекс і смугу', async () => {
			listOwnRooms.mockResolvedValue([own()]);
			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);
			await settle();

			await awaited.leave();

			expect(leaveRoom).toHaveBeenCalledWith('AAAAA');
			expect(forgetOwnRoom).toHaveBeenCalledWith('AAAAA');
			expect(awaited.room).toBeNull();
			expect(awaited.busy).toBe(false);
			expect(stopped(stopInfo)).toContain('AAAAA');
		});

		it('без смуги виходити нема звідки', async () => {
			const awaited = new AwaitedRoom();
			await awaited.leave();
			expect(leaveRoom).not.toHaveBeenCalled();
		});

		/** Невдача — це довідка, а не поломка сторінки, до якої смуга не має стосунку. */
		it('невдалий вихід не кидає й лишає смугу на місці', async () => {
			listOwnRooms.mockResolvedValue([own()]);
			leaveRoom.mockRejectedValue(new Error('permission_denied'));
			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);
			await settle();

			await expect(awaited.leave()).resolves.toBeUndefined();
			expect(awaited.room?.code).toBe('AAAAA');
			expect(awaited.busy).toBe(false);
		});
	});

	describe('несправність мережі', () => {
		it('нечитаний індекс не кидає й не міняє екрана', async () => {
			listOwnRooms.mockRejectedValue(new Error('offline'));
			const awaited = new AwaitedRoom();
			await expect(awaited.refresh(NOW)).resolves.toBeUndefined();
			expect(awaited.room).toBeNull();
		});

		/**
		 * Друга підписка впала, коли перша вже жива. Без зняття «половини шляху»
		 * вона лишилася б назавжди — і, на відміну від витоку після закриття, про
		 * неї не знала б навіть замикачка.
		 */
		it('падіння другої підписки знімає першу', async () => {
			listOwnRooms.mockResolvedValue([own()]);
			watchOthers.mockRejectedValueOnce(new Error('permission_denied'));
			const awaited = new AwaitedRoom();
			await awaited.refresh(NOW);
			await settle();

			expect(stopped(stopInfo), 'перша підписка лишилася без нагляду').toContain('AAAAA');
		});
	});
});
