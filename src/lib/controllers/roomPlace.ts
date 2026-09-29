import { withRoom, withoutRoom } from '$lib/utils/roomUrl';
import { announceFrom } from '$lib/utils/crossGame';
import type { RoomPlace } from './roomGame';

/** Крок в історії — `goto` із `$app/navigation`, переданий сторінкою. */
export type Navigate = (
	url: URL,
	options: { noScroll: boolean; keepFocus: boolean; replaceState?: boolean }
) => Promise<void>;

/**
 * КУДИ ВЕДУТЬ ДВЕРІ — шляхи з мовою сторінки (`langPath`), бо лише сторінка її знає.
 *
 * `game` — сторінка онлайн-гри за `gameId` кімнати; `null` — такої гри немає.
 */
export interface PlaceRoutes {
	hub(): string;
	game(gameId: string): string | null;
}

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
 *
 * Двері без наміру (`hub`), нова кімната замість тієї, яку нікому вести (`recreate`), і
 * кімната іншої гри (`elsewhere`) — ЗАМІНОЮ запису в історії: «назад» не мусить вертати на
 * адресу, з якої сторінка саме пішла сама.
 */
export function roomPlace(
	url: () => URL,
	navigate: Navigate,
	browser: boolean,
	routes: PlaceRoutes
): RoomPlace {
	const step = { noScroll: true, keepFocus: true };
	const replace = { ...step, replaceState: true };
	const param = (name: string) => (browser ? url().searchParams.get(name) : null);
	/*
	 * КУДИ ВИХОДИМО, коли це вже названо (`exit(to)`). Господар, що закрив кімнату кнопкою
	 * «Головне меню», виходить туди — а політика кімнати, побачивши її закритою, кличе
	 * `exit()` сама й повернула б його на двері гри. Хто з двох викликів буде останнім,
	 * не відомо, тож ціль одна на обидва.
	 */
	let leavingTo: string | null = null;
	return {
		urlRoom: () => param('room') ?? '',
		moved: () => param('move') === '1',
		remember: async (code) => {
			if (!browser) return;
			// Адреса з наміром (`?create`, `?from`) свою справу зробила — ЗАМІНОЮ: «назад» із
			// кімнати не мусить вертати на неї, бо двері створили б ще одну кімнату.
			const intent = url().searchParams.has('create') || url().searchParams.has('from');
			await navigate(withRoom(url(), code), intent ? replace : step);
		},
		exit: (to) => {
			if (to) leavingTo = to;
			return leavingTo
				? navigate(new URL(leavingTo, url()), replace)
				: navigate(withoutRoom(url()), step);
		},
		announce: (code) => announceFrom(url(), code),
		creating: () => {
			const wanted = param('create');
			return wanted === 'friends' ? true : wanted === 'everyone' ? false : null;
		},
		choosing: () => param('from') !== null && param('create') === null,
		hub: () => navigate(new URL(routes.hub(), url()), replace),
		recreate: (isPrivate) => {
			const next = withoutRoom(url());
			next.searchParams.set('create', isPrivate ? 'friends' : 'everyone');
			return navigate(next, replace);
		},
		elsewhere: (gameId, code) => {
			const path = routes.game(gameId);
			if (path === null) return false;
			const next = new URL(path, url());
			next.searchParams.set('room', code);
			// Людина вже вирішила зайти — вікна «вас запросили» на тій сторінці їй не треба.
			next.searchParams.set('move', '1');
			void navigate(next, replace);
			return true;
		}
	};
}
