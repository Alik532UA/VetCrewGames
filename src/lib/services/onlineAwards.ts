import { storage } from './storage';

/**
 * БАЛИ ЗА СПІЛЬНУ ПАРТІЮ — РІВНО ОДИН РАЗ на (кімнату, зерно), і між
 * перезавантаженнями теж.
 *
 * Доти ключем ідемпотентності була змінна в памʼяті сторінки (`awardedSeed`), а
 * завершена кімната лишалася в переліку «продовжити»: перезавантажив сторінку й
 * зайшов у виграну партію — отримав бали вдруге, і так скільки завгодно. Рахунок
 * синхронізується в таблицю лідерів, тож це було вже не косметикою (аудит
 * 2026-09-23).
 *
 * Сховище, а не база: бали нараховує цей пристрій і лише собі. Стеля — останні
 * `KEEP` партій: старіші кімнати вже прибрані збирачем, і повернутися в них
 * нікуди.
 */
const KEY = 'onlineAwarded';
const KEEP = 40;

function awarded(): string[] {
	try {
		const raw = storage.get(KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
	} catch {
		// Зіпсований запис у сховищі означає «ще нічого не нараховано»: гірший
		// наслідок — повторні бали за партію, а не зламана сторінка.
		return [];
	}
}

/**
 * Нарахувати, якщо за цю партію ще не нараховували. `true` — нарахували зараз.
 */
export function awardOnce(code: string, seed: number, award: () => void): boolean {
	const key = `${code}:${seed}`;
	const done = awarded();
	if (done.includes(key)) return false;
	award();
	storage.set(KEY, JSON.stringify([...done, key].slice(-KEEP)));
	return true;
}
