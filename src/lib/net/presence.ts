import { ROOM_BEAT_MS } from '$lib/config/roomLife';
import { connect } from './firebase';
import { logService } from '$lib/services/logService.svelte';

/**
 * Усе, що тримається на `onDisconnect` — тобто на обіцянці, яку виконує СЕРВЕР,
 * коли клієнт зник.
 *
 * **Чому це окремий модуль, а не частина кімнати.** Тут інша природа записів:
 * кімната й журнал ходів — це те, що застосунок пише навмисно й що мусить
 * переживати обрив звʼязку. Присутність — навпаки: вона існує рівно доти, доки
 * живий сокет, і зникає без жодної участі коду. Змішані в одному файлі, ці дві
 * речі читаються як одна, і з'являється спокуса «прибирати учасника при обриві»
 * (§ 9.2 канону — саме те, чого робити не можна: склад задає роздачу, тож чийсь
 * тунель у метро перероздав би дошку всім).
 *
 * **Чому взагалі RTDB, а не Firestore.** Через `onDisconnect()`. У грі на двох
 * питання «суперник вийшов чи просто думає» вирішує, чи партія зависне назавжди;
 * у Firestore такого механізму немає, і офіційна порада — підключити поруч RTDB.
 * Тобто «лише Firestore» тут закінчилося б ДВОМА базами
 * (CLOUD-DATABASE-v8 § 5.1).
 */

/**
 * Тримати присутність: поки вкладка жива — запис є, зникла — Firebase прибере
 * його сам. Уся механіка — у `keepNode` нижче; тут лише шлях і вміст.
 *
 * Вхід у кімнату присутності НЕ ЧЕКАЄ: вона встане з першим «на звʼязку», а
 * без звʼязку чекати її означало б не пускати в кімнату, де вже все відкрито.
 */
export async function trackPresence(code: string): Promise<() => void> {
	const { uid } = await connect();
	const { serverTimestamp } = await import('firebase/database');
	const kept = await keepNode(
		`presence/${code}/${uid}`,
		() => ({ at: serverTimestamp() }),
		(error) => logService.warn('network', 'presence not restored', { code, reason: String(error) })
	);
	// Першої спроби вхід не чекає — тож і її відмову називаємо тут, а не мовчимо.
	kept.ready.catch((error: unknown) =>
		logService.warn('network', 'presence not registered', { code, reason: String(error) })
	);
	/*
	 * СВІЖИЙ `at` ЗА РОЗКЛАДОМ СЕРЦЕБИТТЯ (аудит 2026-09-25). Доти він писався раз на
	 * зʼєднання, і прибиральник, що стирає присутність, старшу за шість годин, стирав
	 * живу — у господаря, який просто довго сидить на звʼязку. Лише поле `at`, а не
	 * весь вузол: `set` усього вузла стирав би підсвітку наведення в «Знайди пару».
	 */
	const beat = setInterval(() => kept.touch('at', serverTimestamp()), ROOM_BEAT_MS);
	return () => {
		clearInterval(beat);
		kept.stop();
	};
}

/** Вузол, який `keepNode` тримає живим. */
export interface KeptNode {
	/** Перший запис: кидає, якщо база відмовила. Хто не чекає — нічого не втрачає. */
	ready: Promise<void>;
	/**
	 * Оновити ОДНЕ поле живого вузла — лише коли він є й домовленість цього
	 * зʼєднання вже стоїть: інакше частковий запис став би вузлом без прибирання.
	 */
	touch(field: string, value: unknown): void;
	/** Перестати тримати й прибрати вузол. */
	stop: () => void;
}

/**
 * ТРИМАТИ ВУЗОЛ, ПОКИ Я НА ЗВʼЯЗКУ, — і прибраним, коли ні. Спільне для
 * присутності й запису кімнати в переліку: обидва тримаються на `onDisconnect`.
 *
 * Порядок не косметика: спершу домовляємось, ЩО прибрати, і лише тоді
 * зʼявляємось. У зворотному порядку існує вікно, у якому запис уже є, а
 * домовленості про його прибирання ще немає, — і зникнення клієнта в цю мить
 * лишає привида назавжди.
 *
 * ## На КОЖНЕ «на звʼязку», включно з першим (аудит 2026-09-24)
 *
 * `onDisconnect` виконується один раз: обірвався сокет — сервер прибрав запис, і
 * домовленості більше немає. Доти вузол ставився раз, а слухач обриву вмикався
 * лише ПІСЛЯ першого запису й перше «на звʼязку» пропускав. Обрив посеред того
 * першого запису лишав вузол без домовленості — привида: господар-привид ніколи
 * не виглядав відсутнім (тож ведення ніхто не підхоплював), раунди вікторини його
 * чекали, а «швидка гра» вела в кімнату-привид. Тепер кожне зʼєднання має свій
 * номер, і запис, що обірвався посередині, повторюється в новому зʼєднанні.
 *
 * ## Вузол зник, а я на звʼязку — поставити знову (`watch`)
 *
 * Вузол один на людину, а вкладок буває дві: закрилась одна — її `onDisconnect`
 * прибрав спільний вузол, і друга, досі відкрита, лишалася «відсутньою» для всіх.
 * Для цього вузол треба ЧИТАТИ, а це можна не всюди: запис переліку кімнат
 * читається лише обмеженим запитом усієї гілки, тож там `watch: false` — і
 * друга вкладка господаря запису не відновить (рідкість, і шкода лише в тому,
 * що кімната до наступного обриву не видна в списку).
 *
 * ## Відмова — до наступного зʼєднання
 *
 * SDK показує свій запис одразу й відкочує, коли база відмовила; відкат — це
 * «вузол зник», і без зупинки це було б коло з частотою мережі (той самий
 * різновид, що вже був у старті партії). Тому після відмови — тиша до
 * наступного «на звʼязку».
 */
export async function keepNode(
	path: string,
	value: () => object | null,
	onRefused: (error: unknown) => void,
	{ watch = true, refreshMs }: { watch?: boolean; refreshMs?: number } = {}
): Promise<KeptNode> {
	const { db } = await connect();
	const { child, onDisconnect, onValue, ref, remove, set } = await import('firebase/database');
	const node = ref(db, path);
	const status = ref(db, '.info/connected');

	let online = false;
	let stopped = false;
	let refused = false;
	let pending = false;
	/** Номер зʼєднання: росте на кожне «на звʼязку». */
	let epoch = 0;
	/** Чи вузол зараз є — з власної підписки (лише коли `watch`). */
	let exists = false;
	/** Зʼєднання, у якому домовленість і запис уже зроблено; `-1` — ні в якому. */
	let registered = -1;
	let first: { resolve: () => void; reject: (error: unknown) => void } | null = null;
	const ready = new Promise<void>((resolve, reject) => (first = { resolve, reject }));
	// Позначено як оброблене: хто не чекає першого запису, не мусить ловити його відмову.
	ready.catch(() => {});

	const register = async (): Promise<void> => {
		// `null` — тримати нічого (запис зняли): інакше кожне «на звʼязку» ходило б по колу.
		if (stopped || pending || refused || !online || registered === epoch || value() === null)
			return;
		pending = true;
		const at = epoch;
		try {
			await onDisconnect(node).remove();
			const current = value();
			if (stopped || current === null) return;
			await set(node, current);
			registered = at;
			first?.resolve();
			first = null;
		} catch (error) {
			refused = true;
			if (first) first.reject(error);
			else onRefused(error);
			first = null;
		} finally {
			pending = false;
		}
		// Поки писали, звʼязок обірвався й повернувся: домовленість лишилась у старому.
		if (registered !== epoch) void register();
	};

	// Відписки — те, що повернув `onValue`: `off()` знімає лише той самий колбек.
	const unStatus = onValue(status, (snapshot) => {
		online = snapshot.val() === true;
		if (!online) return;
		epoch += 1;
		refused = false;
		void register();
	});
	const unNode = watch
		? onValue(
				node,
				(snapshot) => {
					exists = snapshot.exists();
					if (exists || !online) return;
					registered = -1;
					void register();
				},
				(error) =>
					logService.warn('network', 'kept node not watched', { path, reason: String(error) })
			)
		: null;
	/*
	 * ВУЗОЛ, ЯКОГО НЕ ВИДНО, — ПЕРЕПИСУВАТИ ЗА РОЗКЛАДОМ (`refreshMs`). Запис
	 * переліку правило читати не дає, тож зникнення його не почути: домовленість
	 * СТАРОГО сокета сервер виконує, коли помітить його смерть, — а це буває вже після
	 * того, як нове зʼєднання запис поставило. Господар, що перейшов з Wi-Fi на
	 * мобільний звʼязок, мовчки зникав зі списку й зі «швидкої гри» до наступного
	 * обриву (аудит 2026-09-25).
	 */
	const refresh =
		refreshMs === undefined
			? null
			: setInterval(() => {
					registered = -1;
					void register();
				}, refreshMs);

	return {
		ready,
		touch: (field, next) => {
			if (stopped || !online || registered !== epoch || (watch && !exists)) return;
			set(child(node, field), next).catch((error: unknown) =>
				logService.warn('network', 'kept node not touched', { path, reason: String(error) })
			);
		},
		stop: () => {
			stopped = true;
			if (refresh !== null) clearInterval(refresh);
			unStatus();
			unNode?.();
			remove(node).catch((error: unknown) =>
				logService.warn('network', 'node not removed', { path, reason: String(error) })
			);
		}
	};
}

/**
 * Чи є звʼязок із базою ЗАРАЗ — для смуги «немає звʼязку».
 *
 * Перший виклик приходить одразу з поточним станом. Firebase віддає `false` і
 * тоді, коли звʼязок ще не встановився, тож показувати смугу варто не з першої
 * миті, а коли стан ТРИМАЄТЬСЯ (це вирішує екран).
 */
export async function watchConnected(onChange: (connected: boolean) => void): Promise<() => void> {
	const { db } = await connect();
	const { onValue, ref } = await import('firebase/database');
	const status = ref(db, '.info/connected');
	return onValue(status, (snapshot) => onChange(snapshot.val() === true));
}

/**
 * СКАЗАТИ, НА ЯКУ КАРТКУ Я ДИВЛЮСЯ. `null` — ні на яку.
 *
 * Прохання автора: «наведення на картку — бачать усі в грі». Живе це в
 * присутності, а не в журналі ходів: журнал — правда про партію, з якої кожен
 * відтворює дошку, а наведення стану партії не змінює. У журналі воно ще й
 * лишалося б назавжди — сотні записів, які всі перепрогонюють щознімка.
 *
 * ПИШЕТЬСЯ ПОДІЯ, А НЕ РУХ, і це поправка автора: «не треба кожний рух курсора
 * записувати, а тільки саму подію наведення — навіщо знати, що гравець водить по
 * картці курсором, і забивати трафік». Тому виклик стоїть на `pointerenter` і
 * `pointerleave`, тобто кілька записів на хід, а не кілька на секунду.
 *
 * НЕ КИДАЄ: підсвітка — довідка, і її несправність не має права ламати партію.
 * Той самий підхід, що в `touch()` у транспорті кімнати.
 */
export async function setHover(code: string, card: number | null): Promise<void> {
	try {
		const { uid, db } = await connect();
		const { ref, remove, set } = await import('firebase/database');
		const mine = ref(db, `presence/${code}/${uid}/hover`);
		await (card === null ? remove(mine) : set(mine, card));
	} catch {
		// Тихо: наступне наведення спробує знову, а партія від цього не залежить.
	}
}

/**
 * На що дивляться ІНШІ: uid → індекс картки.
 *
 * Окрема підписка на ту саму гілку, а не розширення `watchPresence`: той
 * відповідає на «хто онлайн» і потрібен ОБОМ іграм, а підсвітка — лише «Знайди
 * пару». Обидві слухають один шлях, тож база віддає його один раз.
 *
 * Себе з переліку прибираємо тут, а не на екрані: свою підсвітку гравець і так
 * бачить курсором, а власна пунктирна рамка поверх наведення читалася б як другий,
 * незрозумілий стан.
 */
export async function watchHovers(
	code: string,
	onChange: (byUid: Record<string, number>) => void
): Promise<() => void> {
	const { uid, db } = await connect();
	const { onValue, ref } = await import('firebase/database');
	return onValue(
		ref(db, `presence/${code}`),
		(snapshot) => {
			const out: Record<string, number> = {};
			const all = (snapshot.val() ?? {}) as Record<string, { hover?: number }>;
			for (const [who, node] of Object.entries(all)) {
				if (who !== uid && typeof node?.hover === 'number') out[who] = node.hover;
			}
			onChange(out);
		},
		// Підсвітка — довідка: без неї рамок просто немає, а не стара рамка назавжди.
		(error) => {
			logService.warn('network', 'hover listener cancelled', { code, reason: String(error) });
			onChange({});
		}
	);
}

/** Хто зараз на звʼязку. Підписка, бо це найшвидша частина стану. */
export async function watchPresence(
	code: string,
	onChange: (online: string[]) => void
): Promise<() => void> {
	const { db } = await connect();
	const { onValue, ref } = await import('firebase/database');
	/*
	 * Скасовану підписку НАЗИВАЄМО, а не гасимо мовчки (аудит 2026-09-24). Порожнім
	 * списком не підміняємо: «нікого немає» в партії означає «забрати ведення» й
	 * «чекати всіх», тобто вигадана порожнеча зрушила б гру. Лишається останнє, що
	 * було відомо, — і запис у журналі, за яким причину видно.
	 */
	return onValue(
		ref(db, `presence/${code}`),
		(snapshot) => onChange(Object.keys(snapshot.val() ?? {})),
		(error) =>
			logService.warn('network', 'presence listener cancelled', { code, reason: String(error) })
	);
}

/**
 * ЧИ Є В КІМНАТІ ХТОСЬ, КРІМ МЕНЕ — одним читанням.
 *
 * Потрібно це сповіщенню «вас чекають у грі»: скарга автора була саме про те, що
 * воно висіло, коли чекати вже нікому. Кімната при цьому виглядала живою — і
 * законно: позначку `aliveAt` оновлює КОЖЕН, хто в ній сидить, тобто моє власне
 * серцебиття лишало її свіжою ще дві хвилини після мого виходу.
 *
 * Присутність відповідає на інше питання, і саме на потрібне: не «коли тут
 * останній раз хтось був», а «хто тут ЗАРАЗ». Вона гасне сама (`onDisconnect`),
 * тож привидів у ній не буває.
 */
export async function othersPresent(code: string): Promise<number> {
	const { uid, db } = await connect();
	const { get, ref } = await import('firebase/database');
	const snapshot = await get(ref(db, `presence/${code}`));
	return othersWaiting(snapshot.val(), uid);
}

/**
 * СКІЛЬКИ ІНШИХ ЧЕКАЄ МЕНЕ — і нуль, якщо я там УЖЕ Є.
 *
 * Присутність одна на людину, а не на вкладку: друга вкладка чи інший пристрій,
 * де партія йде, тримає мій вузол. Доти смуга «вас чекають» показувала саме цю
 * партію, а її «піти» прибирало мій рядок складу — жива вкладка чула «вас
 * прибрали з кімнати», а в «Знайди пару» мої черги пропускалися до кінця (аудит
 * 2026-09-25).
 */
export function othersWaiting(value: unknown, me: string): number {
	const here = Object.keys(value !== null && typeof value === 'object' ? value : {});
	return here.includes(me) ? 0 : here.length;
}

/**
 * Підписка на те саме: скільки в кімнаті інших.
 *
 * Потрібна, щоб сповіщення гасло САМО, коли останній вийшов, — а не висіло, поки
 * людина не перейде на іншу сторінку.
 */
export async function watchOthers(
	code: string,
	onCount: (others: number) => void
): Promise<() => void> {
	const { uid, db } = await connect();
	const { onValue, ref } = await import('firebase/database');
	return onValue(
		ref(db, `presence/${code}`),
		(snapshot) => onCount(othersWaiting(snapshot.val(), uid)),
		// Читати не дають — для смуги «вас чекають» це «чекати нікому».
		(error) => {
			logService.warn('network', 'others listener cancelled', { code, reason: String(error) });
			onCount(0);
		}
	);
}
