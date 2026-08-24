import { connect } from './firebase';
import { logService } from '$lib/services/logService.svelte';
import type { Profile } from './account';

/**
 * ТАБЛИЦЯ ЛІДЕРІВ: публічна копія рахунку — і лише тих, хто цього хотів.
 *
 * ## Чому копія, а не читання чужого `play`
 *
 * Рахунок приватний за замовчуванням: `users/{uid}/play` читає лише власник.
 * Таблиця ж публічна за призначенням, тож у ній лежить рівно те, що показує її
 * рядок, — імʼя, псевдонім, аватар, країна, рахунок. Відкрити для таблиці `play`
 * означало б відкрити всі геймплейні дані всіх.
 *
 * ## Поріг у 50 очок — умова ЗАПИСУ
 *
 * Не фільтр показу. Правило бази не дає створити запис із меншим рахунком, тобто
 * таблиця не заповнюється тими, хто зробив два ходи й закрив вкладку. Сусідній
 * `Slovko` має той самий поріг (50), але фільтрує ним показ — і через це читає
 * сто записів, щоб показати двадцять.
 *
 * ## НЕ КИДАЄ
 *
 * Ні публікація, ні читання: таблиця — приємний додаток, а не умова гри. Запис,
 * якого не дало правило (пошук вимкнений, рахунок нижчий за поріг), не мусить
 * ставати помилкою на екрані партії.
 */

/** Скільком рядкам бути в таблиці. Правило бази вимагає тієї самої межі. */
export const BOARD_LIMIT = 50;

/** Скільки очок треба, щоб узагалі бути в таблиці. Те саме число в правилі. */
export const BOARD_MIN_SCORE = 50;

/** Рядок таблиці. Те саме, що видно в кімнаті, плюс рахунок. */
export interface Leader {
	uid: string;
	name: string;
	handle: string;
	score: number;
	country?: string;
	avatar?: string;
}

/**
 * Показати себе в таблиці — або прибрати звідти.
 *
 * Кличеться після кожного злиття рахунку: рядок мусить наздоганяти рахунок, а не
 * лишатися знімком того дня, коли людина відкрила сторінку акаунта.
 */
export async function publishLeader(profile: Profile, score: number): Promise<void> {
	try {
		const { uid, db } = await connect();
		const { ref, serverTimestamp, set } = await import('firebase/database');
		await set(ref(db, `leaders/${uid}`), {
			name: profile.name,
			handle: profile.handle,
			score,
			...(profile.country ? { country: profile.country } : {}),
			...(profile.avatar ? { avatar: profile.avatar } : {}),
			at: serverTimestamp()
		});
	} catch (error) {
		logService.warn('network', 'leader row not published', { reason: String(error) });
	}
}

/** Прибрати себе з таблиці. Дозволено завжди — навіть нижче порога. */
export async function withdrawLeader(): Promise<void> {
	try {
		const { uid, db } = await connect();
		const { ref, remove } = await import('firebase/database');
		await remove(ref(db, `leaders/${uid}`));
	} catch (error) {
		logService.warn('network', 'leader row not withdrawn', { reason: String(error) });
	}
}

/**
 * Найкращі — обмеженим запитом за рахунком.
 *
 * `limitToLast`, а не `limitToFirst`: RTDB упорядковує за зростанням, тож
 * найбільші рахунки лежать у кінці. Тому й перевертається результат — база
 * повертає його від меншого до більшого.
 */
export async function topLeaders(): Promise<Leader[]> {
	try {
		const { db } = await connect();
		const { get, limitToLast, orderByChild, query, ref } = await import('firebase/database');
		const found = await get(
			query(ref(db, 'leaders'), orderByChild('score'), limitToLast(BOARD_LIMIT))
		);
		if (!found.exists()) return [];

		const rows: Leader[] = [];
		found.forEach((child) => {
			rows.push({ uid: child.key as string, ...(child.val() as Omit<Leader, 'uid'>) });
		});
		return rows.reverse();
	} catch (error) {
		logService.warn('network', 'leaders not read', { reason: String(error) });
		return [];
	}
}

/**
 * Рядки конкретних людей — саме ним будується вкладка «друзі».
 *
 * Читаються ПО ОДНОМУ й паралельно, а не запитом: підписки вже відомі, а запит
 * «ці двадцять» у RTDB не існує. Кого немає в таблиці (вимкнув показ або не
 * дійшов до порога) — той просто зникає зі списку.
 */
export async function leadersOf(uids: string[]): Promise<Leader[]> {
	if (!uids.length) return [];
	try {
		const { db } = await connect();
		const { get, ref } = await import('firebase/database');
		const rows = await Promise.all(
			uids.map(async (uid) => {
				const snapshot = await get(ref(db, `leaders/${uid}`)).catch(() => null);
				if (!snapshot?.exists()) return null;
				return { uid, ...(snapshot.val() as Omit<Leader, 'uid'>) };
			})
		);
		return rows
			.filter((row): row is Leader => row !== null)
			.sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle));
	} catch (error) {
		logService.warn('network', 'friend leaders not read', { reason: String(error) });
		return [];
	}
}
