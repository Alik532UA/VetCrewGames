import { settings } from '$lib/services/settings.svelte';
import { logService } from '$lib/services/logService.svelte';
import { awardOnce } from '$lib/services/onlineAwards';
import { COUNTDOWN_MS } from '$lib/config/roomLife';
import { toast } from './toast.svelte';
import type { RoomMatch, RoomSession } from './roomSession.svelte';

/**
 * Скільки господаря немає на звʼязку, перш ніж ведення підхопить перший за
 * порядком присутній гравець (наступний — ще через стільки ж). Це терпіння, а не
 * право: право дає правило бази (господаря справді немає в присутності).
 */
export const LEAD_AFTER_MS = 20_000;

/**
 * ПОЛІТИКИ КІМНАТИ — те, що сесія робить САМА, коли змінюється стан.
 *
 * Окремо від самої сесії, бо це інший рід коду: сесія — дії на прохання людини
 * (увійти, почати, закрити), а тут — реакції на стан (цокати годинником, вести
 * лічильник переліку, запускати відлік, дати бали, підхопити ведення). Разом вони
 * не влазили в межу розміру контролера — і читалися б як одне ціле, хоча це два.
 *
 * Кличеться з `RoomSession.attach()` під час ініціалізації сторінки, тож ефекти
 * належать компоненту й гаснуть разом із ним.
 */
export function attachRoomPolicies<M extends RoomMatch>(session: RoomSession<M>): void {
	// Адреса — джерело правди: «назад» знімає `?room`, і кімната мусить зникнути.
	$effect(() => {
		if (session.match && session.place.urlRoom() !== session.code) session.leave();
	});

	// Словник імен довантажується, тож стежимо за мовою.
	$effect(() => void session.player.load(settings.locale, session.lobby.takenNames));

	// Перелік і свої партії — лише поки видно форму входу: під час партії підписка
	// слухала б чужі кімнати й платила трафіком за кожну чужу зміну.
	$effect(() =>
		session.match ? undefined : session.lobby.watch((names) => session.player.settle(names))
	);
	$effect(() => (session.match ? undefined : session.lobby.load()));

	// Годинник цокає, поки на нього дивляться — і поки господаря немає.
	$effect(() => {
		const match = session.match;
		const wanted = match ? session.game.clockEvery(match) : null;
		const every = session.hostAway ? Math.min(wanted ?? 1000, 1000) : wanted;
		if (every === null) return;
		session.clock = session.now();
		const timer = setInterval(() => (session.clock = session.now()), every);
		return () => clearInterval(timer);
	});

	// Господар веде лічильник гравців у своєму записі переліку — у ОБОХ іграх.
	$effect(() => {
		const match = session.match;
		if (!match || !session.amHost || match.status !== 'lobby') return;
		void session.lobby.setPlayers(session.code, match.players.length);
	});

	// Відлік автостарту вмикає ГОСПОДАР — і ВИМИКАЄ, коли гравців стало замало.
	// Після відмови бази — не сам: інакше відкат запису вмикав би відлік знову й знову.
	$effect(() => {
		const match = session.match;
		if (!match || !session.amHost || match.status !== 'lobby' || session.autoHalted) return;
		const ready = match.autoStart && session.game.autoStartReady(match.players.length);
		if (ready !== (match.countdownAt !== null)) {
			void session
				.hostAction((transport) => transport.setCountdown(ready))
				.then((done) => (session.autoHalted ||= !done));
		}
	});

	// Відлік вийшов — партія починається. Таймер господаря: `playing` пише лише він.
	$effect(() => {
		const match = session.match;
		if (!match || !session.amHost || match.status !== 'lobby' || match.countdownAt === null) return;
		if (session.autoHalted) return;
		const left = Math.max(0, match.countdownAt + COUNTDOWN_MS - session.now());
		const timer = setTimeout(() => void session.start(true), left);
		return () => clearTimeout(timer);
	});

	// Серцебиття кімнати, поки вона відкрита: за ним «продовжити партію» відрізняє
	// покинуту кімнату від тієї, з якої щойно вийшли.
	$effect(() => (session.match && session.code ? session.net.beat(session.code) : undefined));

	// Бали — рівно раз на (кімнату, зерно), і між перезавантаженнями теж.
	$effect(() => {
		const match = session.match;
		if (!match?.over) return;
		awardOnce(session.code, match.seed, () => session.game.award(match, session.me));
	});

	watchHost(session);

	// Кімнати більше немає — сказати про це й повернути на форму входу.
	$effect(() => {
		if (!session.match?.gone) return;
		toast.info('pairs.roomClosed');
		void session.place.exit();
	});
}

/**
 * ГОСПОДАРЯ НЕМАЄ ДОСИТЬ ДОВГО — ПІДХОПИТИ ВЕДЕННЯ.
 *
 * Першим пробує присутній гравець із найменшим порядком, наступний — ще через
 * `LEAD_AFTER_MS`, якщо перший не встиг. Законність вирішує правило бази
 * (господаря справді немає в присутності), а таймер лише не дає короткому обриву
 * змінити ведучого.
 */
function watchHost<M extends RoomMatch>(session: RoomSession<M>): void {
	let goneSince: number | null = null;
	let taking = false;

	$effect(() => {
		const clock = session.clock;
		const match = session.match;
		if (!match || !session.hostAway) {
			goneSince = null;
			return;
		}
		goneSince ??= clock;
		const here = match.players.filter((player) => session.online.includes(player.uid));
		const rank = here.findIndex((player) => player.uid === session.me);
		if (rank < 0 || taking || clock - goneSince < LEAD_AFTER_MS * (rank + 1)) return;
		taking = true;
		void match
			.takeLead()
			.then((taken) => {
				if (taken) toast.info('pairs.youLead');
			})
			.catch((error: unknown) =>
				logService.warn('network', 'lead not taken', { reason: String(error) })
			)
			.finally(() => (taking = false));
	});
}
