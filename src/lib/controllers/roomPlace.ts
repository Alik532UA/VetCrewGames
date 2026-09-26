import { withRoom, withoutRoom } from '$lib/utils/roomUrl';
import { announceFrom } from '$lib/utils/crossGame';
import type { RoomPlace } from './roomGame';

/** Крок в історії — `goto` із `$app/navigation`, переданий сторінкою. */
export type Navigate = (
	url: URL,
	options: { noScroll: boolean; keepFocus: boolean }
) => Promise<void>;

/**
 * АДРЕСА СТОРІНКИ КІМНАТИ — одна на обидві гри.
 *
 * Доти цей обʼєкт стояв на обох сторінках копією слово в слово — і перевірити
 * його не було чим: маршрут тест не бере (аудит 2026-09-24). Тепер адреса й
 * перехід приходять аргументами, тож у тесті замість браузера — звичайний `URL`.
 *
 * Адреса — ДЖЕРЕЛО ПРАВДИ про кімнату, і крок в історії робить `goto`, а не
 * `pushState`: поверхнева маршрутизація не присвоює `page.url`, і ефект «адреса —
 * джерело правди» бачив би «кімнати немає» одразу після входу (дефект 2026-08-24,
 * під інваріантом у `src/structure.test.ts`).
 *
 * `browser` — бо на пререндері адреси з `?room` немає, а `page.url.searchParams`
 * під час пререндеру КИДАЄ (локальна пастка в AGENTS.md).
 */
export function roomPlace(url: () => URL, navigate: Navigate, browser: boolean): RoomPlace {
	const step = { noScroll: true, keepFocus: true };
	return {
		urlRoom: () => (browser ? (url().searchParams.get('room') ?? '') : ''),
		moved: () => browser && url().searchParams.get('move') === '1',
		remember: async (code) => {
			if (browser) await navigate(withRoom(url(), code), step);
		},
		exit: () => navigate(withoutRoom(url()), step),
		announce: (code) => announceFrom(url(), code)
	};
}
