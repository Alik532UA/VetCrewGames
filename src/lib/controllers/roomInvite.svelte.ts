import { logService } from '$lib/services/logService.svelte';
import { takenAvatars } from '$lib/utils/roomAvatars';
import type { Member } from '$lib/net/roomTypes';
import type { RoomMatch, RoomSession } from './roomSession.svelte';

/**
 * ВАС ЗАПРОСИЛИ — КОРОТКЕ ВІКНО ПЕРЕД КІМНАТОЮ (рішення автора 2026-09-26, 9-A).
 *
 * Доти адреса з `?room` означала лише «я вже тут був — повертаємося самі», і той, хто
 * вперше відкрив посилання чи QR-код, заходив у кімнату мовчки: з тим іменем, яке
 * вигадав кубик, без прапора й з аватаркою, якої не вибирав. Змінити будь-що з цього
 * потім не було де, крім ролі.
 *
 * Тепер ДО входу розрізняються двоє:
 *
 *  • ТОЙ, ХТО ВЖЕ В СКЛАДІ (перезавантажив сторінку, повернувся з іншої вкладки) —
 *    заходить сам, як і доти: питати в нього, як його звати, посеред партії було б
 *    знущанням;
 *  • НОВАЧОК — бачить вікно: імʼя, прапор, аватарка (зайняті пари кімнати не
 *    вибрати) і «Зайти». Або «До переліку кімнат», якщо відкрив не те.
 *
 * Третій випадок — ПЕРЕЇЗД ГРУПИ в кімнату іншої гри (`?move=1` у посиланні
 * «перейти», `utils/crossGame.ts`): ці люди щойно грали разом і все про себе вже
 * сказали, тож вікно для них — зайвий натиск, і вони заходять самі.
 *
 * Будь-яка невдача перевірки (мережа, кімнати немає) веде старою дорогою — прямим
 * входом: саме він скаже людині, що сталося, тими самими словами, що й доти.
 */
export class RoomInvite<M extends RoomMatch> {
	/** Код кімнати, куди запросили; `null` — вікна немає. */
	code = $state<string | null>(null);
	/** Склад кімнати на мить перевірки — з нього зайняті аватарки. */
	members = $state<Member[]>([]);
	#me = '';

	constructor(readonly session: RoomSession<M>) {}

	/**
	 * Вікно відкрите, поки адреса й досі веде в цю кімнату: «назад» у браузері знімає
	 * `?room`, і вікно мусить зникнути разом із ним, як зникла б кімната.
	 */
	get open(): boolean {
		return this.code !== null && !this.session.match && this.session.place.urlRoom() === this.code;
	}

	/** Пари, які вже тримають у кімнаті (пара → імʼя), — у вікні їх не вибрати. */
	get taken(): Map<string, string> {
		return takenAvatars(this.members, this.#me);
	}

	/** Адреса веде в кімнату — вирішити: заходити самим чи спершу показати вікно. */
	async check(): Promise<void> {
		const code = this.session.place.urlRoom();
		if (!code) return;
		if (this.session.place.moved()) return this.session.resume();
		try {
			const [me, members] = await Promise.all([
				this.session.net.me(),
				this.session.net.peekMembers(code)
			]);
			if (members === null || members.some((member) => member.uid === me)) {
				return this.session.resume();
			}
			// Поки чекали на мережу, людина могла вже піти з цієї адреси.
			if (this.session.place.urlRoom() !== code) return;
			this.#me = me;
			this.members = members;
			this.code = code;
		} catch (error) {
			logService.warn('network', 'invite check failed', { code, reason: String(error) });
			this.session.resume();
		}
	}

	/**
	 * «Зайти» — тим іменем, прапором і аватаркою, що стоять у вікні. Вікно лишається,
	 * доки вхід не доїхав (`open` гасне з матчем): невдалий вхід лишає людину тут, з
	 * тим самим підписом, а не викидає у форму входу.
	 */
	accept(): void {
		this.session.resume();
	}

	/** «До переліку кімнат» — геть з адреси кімнати, у форму входу. */
	decline(): void {
		this.code = null;
		void this.session.place.exit();
	}
}
