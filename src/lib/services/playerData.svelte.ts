import { storage } from './storage';
import { settings } from './settings.svelte';
import { ONLINE_TO_LOCAL } from '$lib/config/scoring';
import { forgetAccount, hasAccount, rememberAccount } from './accountFlag';
import type { GameRecord, PlayData } from '$lib/net/play';

/**
 * ДАНІ ГРАВЦЯ: наскрізний рахунок і рекорд кожної гри — місцева половина.
 *
 * ## Що де живе — і це вимір, а не смак у шаруванні
 *
 * Сам РАХУНОК лишився полем `settings`, і навмисно: його показує шапка на кожній
 * сторінці, тобто той модуль і так лежить у чанку кореневого layout. Рекорди,
 * прапорець акаунта й уся координація з хмарою — тут, а мережа — в
 * `services/playerSync.ts`.
 *
 * Бюджет чанку layout — ГЕЙТ (`npm run check:build`, 120 КБ gzip), і він стоїть
 * рівно на межі. Заміряно на цій самій задачі: цей модуль, потрапивши в той чанк,
 * дає 121 КБ, а зі статичним імпортом `net/play` — 122; статичний імпорт
 * заповідника на сторінці акаунта дав 305 КБ проти стелі 300. Тому layout
 * імпортує лише `accountFlag` (три рядки), а цей модуль — контролери ігор (кожен
 * у своєму чанку маршруту), сторінка акаунта й модуль обміну.
 *
 * Із `net/play` сюди приходять ЛИШЕ типи: `import type` зникає при компіляції,
 * тобто SDK бази не тягне за собою навіть непрямо.
 *
 * ## Місцеве — головне
 *
 * `addScore` пише у сховище й повертається; хмару повідомляє `onChange`, який
 * ставить `playerSync`, коли він узагалі завантажений. Обрив зв'язку означає
 * незбережений рекорд, а не зупинену партію.
 */
class PlayerData {
	/** Рекорд кожної гри за її ключем із `config/menu-games.ts`. */
	records = $state<Record<string, GameRecord>>({});

	/**
	 * ЧИ ЙДЕ ЗАРАЗ ОНЛАЙН-ПАРТІЯ, у якій локальний рахунок не чіпається.
	 *
	 * Онлайн-раунд грається ТИМИ САМИМИ контролерами, що соло, — і вони самі
	 * додавали свої 3–4 очки за кожну правильну відповідь та писали «зіграно
	 * партію» на КОЖЕН раунд. За одну спільну вікторину це виходило дванадцять
	 * партій у рекордах і дванадцять порцій балів, тобто та сама шкала, яку
	 * конвертація нижче й вирівнює, ламалася з іншого боку.
	 *
	 * Тому під час партії місцевий рахунок стоїть, а в кінці зараховується один
	 * раз — `awardOnline()`. Прапорець у пам'яті, а не у сховищі: перезавантаження
	 * сторінки мусить його скидати, інакше вкладка, закрита посеред партії, тихо
	 * вимкнула б рахунок назавжди.
	 */
	#online = false;

	/**
	 * Кого повідомити про зміну. Ставить `playerSync`, і лише він.
	 *
	 * Інверсія тут не з елегантності: пряме звертання до `playerSync` зробило б
	 * імпорт статичним, тобто вернуло б мережу в чанки ігор. А цикл
	 * «playerData → playerSync → playerData» ще й падав би на серверному рендері,
	 * як уже впав у сусідньому `Slovko`.
	 */
	onChange: (() => void) | null = null;

	constructor() {
		const records = storage.getJSON<Record<string, GameRecord>>('records');
		if (records) this.records = sane(records);
	}

	/** Наскрізний рахунок. Живе в `settings` (див. вище), звідси лише читається. */
	get score(): number {
		return settings.score;
	}

	/** Чи цей браузер входив в акаунт. */
	get linked(): boolean {
		return hasAccount();
	}

	/**
	 * Що саме поїде в базу.
	 *
	 * Копія ДВОХ рівнів, а не одного: `{ ...this.records }` копіює лише мапу, а
	 * самі рекорди лишалися б тими самими об'єктами — і правка знімка правила б
	 * стан. Зловив це власний тест, не читання коду.
	 */
	snapshot(): PlayData {
		const games: Record<string, GameRecord> = {};
		for (const [id, record] of Object.entries(this.records)) games[id] = { ...record };
		return { score: this.score, games };
	}

	/**
	 * Додати очки — і сказати про це хмарі.
	 *
	 * Кличуть контролери ігор — усі шість, і жоден із них не знає ні про акаунт, ні
	 * про злиття, ні про затримку запису. Сам рахунок пише `settings` (там він і
	 * живе), а тут до цього додається рівно одне: повідомлення для синхронізації.
	 */
	addScore(points: number): void {
		if (this.#online) return;
		settings.addScore(points);
		this.onChange?.();
	}

	/** Онлайн-партія почалася: локальний рахунок до її кінця не рухається. */
	beginOnline(): void {
		this.#online = true;
	}

	/** Онлайн-партія скінчилася або кімнату покинуто. Ідемпотентно. */
	endOnline(): void {
		this.#online = false;
	}

	/**
	 * Зарахувати підсумок онлайн-партії в наскрізний рахунок.
	 *
	 * Ділення живе тут, а не на місці виклику: сторінка знає свій рахунок партії,
	 * а курс двох шкал — це властивість шкали, і в неї одне місце
	 * (`config/scoring.ts`).
	 *
	 * Прапорець при цьому НЕ перевіряється: саме цей запис і має пройти, хоч
	 * партія ще формально «онлайн». Нуль не пишеться зовсім — ні очок, ні події.
	 */
	awardOnline(points: number): void {
		if (points <= 0) return;
		settings.addScore(points);
		this.onChange?.();
	}

	/**
	 * Підсумок спільної ВІКТОРИНИ — за курсом двох шкал.
	 *
	 * Ділення живе тут, а не на місці виклику: сторінка знає свій рахунок партії,
	 * а курс — властивість шкали, і в неї одне місце (`config/scoring.ts`).
	 */
	awardQuizMatch(matchScore: number): void {
		this.awardOnline(Math.round(matchScore / ONLINE_TO_LOCAL));
	}

	/**
	 * Партія закінчилася: `score` — її власний результат, а не наскрізний.
	 *
	 * `plays` рахується місцево, а зливається максимумом (див. `mergePlay`), тобто
	 * партії з двох пристроїв не складаються. Це ціна ідемпотентності злиття, і
	 * вона названа там, де про неї вирішено.
	 */
	finishGame(id: string, score: number): void {
		// Онлайн-раунд — не партія цієї гри: рекорд і «зіграно» тут не пишуться
		// (рішення автора: за спільну вікторину йде лише наскрізний рахунок).
		if (this.#online) return;
		const previous = this.records[id] ?? { best: 0, plays: 0 };
		this.records = {
			...this.records,
			[id]: { best: Math.max(previous.best, score), plays: previous.plays + 1 }
		};
		storage.setJSON('records', this.records);
		this.onChange?.();
	}

	/** Рекорд гри. `null` — у цю гру ще не грали. */
	recordOf(id: string): GameRecord | null {
		return this.records[id] ?? null;
	}

	/** Прийняти дані, злиті з хмарними. Кличе `playerSync`, і лише він. */
	apply(data: PlayData): void {
		settings.setScore(data.score);
		this.records = { ...data.games };
		storage.setJSON('records', this.records);
	}

	/** Акаунт з'явився: далі рахунок належить йому. */
	markLinked(): void {
		rememberAccount();
	}

	/**
	 * Вийшли з акаунта: місцеве стирається ВСЕ, що стосується гравця.
	 *
	 * Інакше рахунок акаунта лишався б у браузері й уливався б у НАСТУПНИЙ
	 * акаунт, у який тут увійдуть, — тобто рахунок можна було б переписати з
	 * чужого. У сусідньому `MindStep` це рівно так і працює: метод очищення там
	 * написаний, і його не кличе жоден рядок.
	 *
	 * Фонд заповідника стирає не цей сервіс, а той, хто ним володіє: до сховища
	 * фонду ходить лише його контролер (інваріант у `src/structure.test.ts`).
	 */
	clearLocal(): void {
		settings.setScore(0);
		this.records = {};
		storage.remove('score');
		storage.remove('records');
		forgetAccount();
	}
}

/** Запис у сховищі міг побитися: числом вважається лише невід'ємне число. */
function sane(raw: Record<string, GameRecord>): Record<string, GameRecord> {
	const clean: Record<string, GameRecord> = {};
	for (const [id, record] of Object.entries(raw)) {
		clean[id] = { best: count(record?.best), plays: count(record?.plays) };
	}
	return clean;
}

function count(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export const playerData = new PlayerData();
