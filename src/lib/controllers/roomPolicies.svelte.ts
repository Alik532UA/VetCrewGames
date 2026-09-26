import { settings } from '$lib/services/settings.svelte';
import { logService } from '$lib/services/logService.svelte';
import { awardOnce } from '$lib/services/onlineAwards';
import { COUNTDOWN_MS } from '$lib/config/roomLife';
import { leadCandidates } from '$lib/utils/roster';
import { toast } from './toast.svelte';
import type { RoomMatch, RoomSession } from './roomSession.svelte';

/**
 * Скільки господаря немає на звʼязку, перш ніж ведення підхопить перший за
 * порядком присутній гравець (наступний — ще через стільки ж). Це терпіння, а не
 * право: право дає правило бази (господаря справді немає в присутності).
 */
export const LEAD_AFTER_MS = 20_000;

/**
 * Терпіння в ДОГРАНІЙ партії — утричі довше. Раундів, що стоять, там немає, а
 * господар, який натиснув «зіграти в іншу гру», зі старої кімнати ВИХОДИТЬ і
 * заповнює форму нової: за двадцять секунд ведення в нього забирали, і гості
 * чули «тепер ведете ви», поки він просто створював кімнату (аудит 2026-09-25).
 */
export const OVER_LEAD_AFTER_MS = 3 * LEAD_AFTER_MS;

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

	/*
	 * ПУБЛІЧНА КІМНАТА — У ПЕРЕЛІКУ, поки вона в лобі й поки я господар. Одна
	 * політика на три дороги: створення, повернення після перезавантаження (запис
	 * переліку гасне з вкладкою) і перехоплення ведення.
	 */
	$effect(() => {
		const match = session.match;
		if (!match || !session.amHost || match.status !== 'lobby' || !match.listed) return;
		void session.publishListing();
	});

	// Господар веде лічильник гравців у своєму записі переліку — у ОБОХ іграх.
	$effect(() => {
		const match = session.match;
		if (!match || !session.amHost || match.status !== 'lobby') return;
		void session.lobby.setPlayers(session.code, session.presentPlayers.length);
	});

	// Відлік автостарту вмикає ГОСПОДАР — і ВИМИКАЄ, коли гравців стало замало.
	// Після відмови бази — не сам: інакше відкат запису вмикав би відлік знову й знову.
	$effect(() => {
		const match = session.match;
		if (!match || !session.amHost || match.status !== 'lobby' || session.autoHalted) return;
		// Рахуються ТІ, ХТО НА ЗВʼЯЗКУ: гість, що закрив вкладку під час відліку, гасить
		// його, а не потрапляє в заморожений склад привидом.
		const ready = match.autoStart && session.game.autoStartReady(session.presentPlayers.length);
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

	/*
	 * ПАРТІЯ СКІНЧИЛАСЯ — господар закриває її СТАТУСОМ. Доти `over` не писав
	 * ніхто, і скінчена партія лишалася «живою»: смуга «Вас чекають» кликала в неї
	 * кожного, хто вже вийшов із підсумку, поки суперник ще дивився на табло (аудит
	 * 2026-09-24). Реванш повертає `playing` сам. Після відмови бази — не сам (див.
	 * `autoHalted`): відкат запису інакше вертав би умову знову й знову.
	 */
	$effect(() => {
		const match = session.match;
		if (!match?.over || !session.amHost || match.status !== 'playing' || session.autoHalted) return;
		void session
			.hostAction((transport) => transport.setStatus('over'))
			.then((done) => (session.autoHalted ||= !done));
	});

	// Бали — рівно раз на (кімнату, зерно), і між перезавантаженнями теж.
	$effect(() => {
		const match = session.match;
		if (!match?.over) return;
		awardOnce(session.code, match.seed, () => session.game.award(match, session.me));
	});

	// Хід, якого база не прийняла, — привід звірити правила (`RoomSession.rulesStale`).
	$effect(() => {
		if ((session.match?.refused ?? 0) > 0) session.noteDenial();
	});

	watchHost(session);
	journal(session);

	// Кімнати більше немає — сказати про це й повернути на форму входу. Закрита й
	// недоступна — різні слова: «партію завершено» про втрачений доступ збрехало б.
	$effect(() => {
		const gone = session.match?.gone;
		if (!gone) return;
		toast.info(gone === 'lost' ? 'pairs.roomLost' : 'pairs.roomClosed');
		void session.place.exit();
	});

	/*
	 * МЕНЕ ПРИБРАЛИ З КІМНАТИ — сказати про це й повернути на форму входу.
	 *
	 * Доти прибраний не дізнавався нічого: екран жив далі, а кожна відповідь падала
	 * загальним «сервер не дозволив» (хід вимагає членства), аж поки
	 * перезавантаження мовчки не вертало його в кімнату (аудит 2026-09-24).
	 *
	 * «Був і зник», а не просто «немає»: вхід пише рядок ДО підписки, тож знімка
	 * без мене на початку не буває, а зникнути, поки кімната в мене на екрані,
	 * рядок може лише з чужої руки. Закрита кімната — інша подія й інше слово.
	 */
	let seenIn: M | null = null;
	$effect(() => {
		const match = session.match;
		if (!match || match.gone || session.me === '') return;
		if (match.members.some((member) => member.uid === session.me)) {
			seenIn = match;
			return;
		}
		if (seenIn !== match) return;
		seenIn = null;
		toast.info('pairs.removed');
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
 *
 * Кандидати — ЛИШЕ ТІ, КОГО ПРАВИЛО ПУСТИТЬ (`leadCandidates`), і після відмови —
 * не раніше ніж за `LEAD_AFTER_MS`. Доти спроба йшла на кожному такті годинника,
 * по три записи, без жодного рядка в журналі, а першим кандидатом у вікторині
 * міг бути новачок, якого правило не пускає ніколи: партія стояла без ведучого,
 * а база отримувала десяток відмов щосекунди (аудит 2026-09-25).
 */
function watchHost<M extends RoomMatch>(session: RoomSession<M>): void {
	let goneSince: number | null = null;
	let taking = false;
	/** Раніше цієї миті не пробувати: відмова бази за секунду не минає. */
	let retryAt = 0;
	/** Про відмову — один рядок на відсутність господаря, а не на спробу. */
	let refused = false;

	$effect(() => {
		const clock = session.clock;
		const match = session.match;
		if (!match || !session.hostAway) {
			goneSince = null;
			retryAt = 0;
			refused = false;
			return;
		}
		goneSince ??= clock;
		const here = leadCandidates(match.players, match.status, match.roster).filter((player) =>
			session.online.includes(player.uid)
		);
		const rank = here.findIndex((player) => player.uid === session.me);
		if (rank < 0 || taking || clock < retryAt) return;
		const patience = match.over ? OVER_LEAD_AFTER_MS : LEAD_AFTER_MS;
		if (clock - goneSince < patience * (rank + 1)) return;
		taking = true;
		retryAt = clock + patience;
		void match
			.takeLead()
			.then((taken) => {
				if (!taken) {
					if (!refused) logService.info('network', 'lead refused', { code: session.code });
					refused = true;
					return;
				}
				toast.info('pairs.youLead');
				logService.info('network', 'lead taken', { code: session.code });
			})
			.catch((error: unknown) =>
				logService.warn('network', 'lead not taken', { code: session.code, reason: String(error) })
			)
			.finally(() => (taking = false));
	});
}

/**
 * ЩО СТАЛОСЯ З КІМНАТОЮ — У ЖУРНАЛ, із кодом (аудит 2026-09-24).
 *
 * Звіт зі значка сервісу — єдине, що автор бачить після чужої партії, і доти в
 * ньому не було двох найважливіших подій: коли людина лишалася без звʼязку й
 * поверталася, і коли ведення переходило до іншого. Тобто «гра зависла» не мала
 * з чим звіритися.
 *
 * Ключ — код кімнати: перехід в іншу кімнату — не «зміна господаря» й не
 * «повернення звʼязку», а просто інша кімната.
 */
function journal<M extends RoomMatch>(session: RoomSession<M>): void {
	let seen: { code: string; connected: boolean; host: string } | null = null;

	$effect(() => {
		const code = session.code;
		const connected = session.connected;
		const host = session.match?.hostUid ?? '';
		if (code === '' || host === '') return;
		if (seen?.code === code) {
			if (seen.connected !== connected) {
				logService.info('network', connected ? 'connection restored' : 'connection lost', { code });
			}
			if (seen.host !== host) {
				logService.info('network', 'host changed', { code, from: seen.host, to: host });
			}
		}
		seen = { code, connected, host };
	});
}
