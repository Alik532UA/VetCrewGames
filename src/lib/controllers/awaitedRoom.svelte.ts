import { logService } from '$lib/services/logService.svelte';
import type { OwnRoom } from '$lib/net/ownRooms';
import { roomsAwaitingMe } from '$lib/utils/awaitedRoom';

/**
 * «ВАС ЧЕКАЮТЬ У ГРІ» — стан сповіщення, яке живе поза сторінкою партії.
 *
 * ## Задача
 *
 * Гравець вийшов зі сторінки посеред партії. Решта бачить «немає зв'язку» й не
 * знає, чи він вернеться. Він сам не знає, що на нього чекають, — код кімнати жив
 * лише в адресі, а адреса пішла разом зі сторінкою. Автор попросив рівно те, чого
 * бракувало: сповіщення з двома відповідями, «повернутися» й «вийти з кімнати».
 *
 * Друга відповідь важливіша за першу: вона робить ситуацію ПРОЗОРОЮ. Доти вихід
 * назовсім і обрив зв'язку виглядали однаково, і решта мусила вгадувати.
 *
 * ## Як стежимо — і чому саме так
 *
 * Два кроки, і кожен відповідає на своє питання.
 *
 *  1. ЗНАЙТИ — один запит до приватного індексу `myRooms/{uid}` (`listOwnRooms`).
 *     Робиться на вході в застосунок і після того, як людина пішла зі сторінки
 *     онлайну: саме тоді кімната, у якій на неї чекають, і з'являється. Опитувати
 *     індекс постійно означало б платити за відповідь, яка майже завжди та сама.
 *  2. СТЕЖИТИ — жива підписка на ОДИН вузол `rooms/{code}/info`, і лише поки
 *     сповіщення видно. Тобто точність там, де вона потрібна: партія скінчилася
 *     або кімната опустіла — сповіщення гасне саме, без опитувань.
 *
 * Постійної підписки, поки людина ходить по меню, тут навмисно немає: вона
 * платила б трафіком за зміни кімнати, які нікого в цю мить не цікавлять.
 */
export class AwaitedRoom {
	/** Кімната, у якій на мене чекають. `null` — сповіщення немає. */
	room = $state<OwnRoom | null>(null);
	/** Поки триває вихід — кнопки не приймають повторних натисків. */
	busy = $state(false);

	#stopWatch: (() => void) | null = null;

	/**
	 * Перечитати свої кімнати й вибрати ту, що чекає.
	 *
	 * НЕ КИДАЄ: це довідка. Її відсутність лишає екран таким, яким він був — а
	 * виняток звідси зламав би сторінку, до якої сповіщення не має стосунку.
	 */
	async refresh(now = Date.now()): Promise<void> {
		try {
			const [{ listOwnRooms }, { othersPresent }] = await Promise.all([
				import('$lib/net/ownRooms'),
				import('$lib/net/presence')
			]);

			/*
			 * ЧЕКАЄ ЛИШЕ ТА КІМНАТА, У ЯКІЙ ХТОСЬ Є. Свіжість (`aliveAt`) цього не
			 * доводить: позначку оновлює кожен, хто в кімнаті сидить, тобто моє власне
			 * серцебиття лишає її свіжою ще дві хвилини після мого виходу. Саме тому
			 * сповіщення й висіло над порожньою кімнатою — скарга автора.
			 *
			 * Присутність питається лише в КАНДИДАТІВ, а їх зазвичай нуль або один:
			 * дешевий відсів іде першим.
			 */
			for (const room of roomsAwaitingMe(await listOwnRooms(), now)) {
				if ((await othersPresent(room.code)) > 0) {
					this.room = room;
					this.#watch(room.code);
					return;
				}
			}

			this.room = null;
			this.#drop();
		} catch (error) {
			logService.warn('network', 'awaited room not read', { reason: String(error) });
		}
	}

	/**
	 * ПІТИ З КІМНАТИ НАЗОВСІМ. Решта дізнається про це без жодного голосування:
	 * `away` виводиться як «склад мінус присутні», тож рядка немає — і чекати нема
	 * на кого.
	 */
	async leave(): Promise<void> {
		const room = this.room;
		if (!room || this.busy) return;
		this.busy = true;
		try {
			const [{ leaveRoom }, { forgetOwnRoom }] = await Promise.all([
				import('$lib/net/rtdbRoom'),
				import('$lib/net/ownRooms')
			]);
			await leaveRoom(room.code);
			await forgetOwnRoom(room.code);
			this.#drop();
			this.room = null;
		} catch (error) {
			logService.warn('network', 'room not left', { code: room.code, reason: String(error) });
		} finally {
			this.busy = false;
		}
	}

	/** Забути про сповіщення без виходу — коли людина сама зайшла в кімнату. */
	dismiss(): void {
		this.#drop();
		this.room = null;
	}

	/**
	 * Підписка на ОДИН вузол `info`: партія скінчилася або кімната опустіла —
	 * сповіщення гасне саме.
	 */
	/**
	 * ДВІ ПІДПИСКИ, і кожна відповідає на своє питання.
	 *
	 *  * `info` — чи партія ще йде. Скінчилася — смуга не має про що казати;
	 *  * присутність — чи хтось там ще є. Вийшов останній — чекати нікому, і смуга
	 *    мусить згаснути САМА, а не висіти до наступного переходу сторінкою.
	 *
	 * Обидві — по одному вузлу, і живуть лише поки смуга видна.
	 */
	#watch(code: string): void {
		this.#drop();
		void (async () => {
			try {
				const [{ watchRoomInfo }, { watchOthers }] = await Promise.all([
					import('$lib/net/rtdbRoom'),
					import('$lib/net/presence')
				]);

				const stopInfo = await watchRoomInfo(code, (info) => {
					if (!info || info.status !== 'playing') this.room = null;
				});
				const stopOthers = await watchOthers(code, (others) => {
					if (others === 0) this.room = null;
				});

				this.#stopWatch = () => {
					stopInfo();
					stopOthers();
				};
			} catch (error) {
				logService.warn('network', 'awaited room not watched', { code, reason: String(error) });
			}
		})();
	}

	#drop(): void {
		this.#stopWatch?.();
		this.#stopWatch = null;
	}
}

/** Один на застосунок: сповіщення живе в кореневому layout. */
export const awaitedRoom = new AwaitedRoom();
