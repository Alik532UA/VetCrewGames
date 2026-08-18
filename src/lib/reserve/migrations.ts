/**
 * Драбина міграцій сейва: `MIGRATIONS[n]` піднімає версію `n` до `n + 1`.
 *
 * Окремим файлом, бо вона РОСТЕ, а `save.ts` — ні. Там форма документа й
 * перевірка полів, тут — історія його змін, і кожна нова сходинка додає рядки
 * саме сюди. Такий файл уже був у часи, коли документ описував одну ділянку, і
 * повернувся з першою ж зміною форми фонду.
 *
 * Механізм ходить сходами ПО ОДНІЙ (див. `restore`), тож сходинка мусить думати
 * лише про свою пару версій і нічого не знати про решту.
 */

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export const MIGRATIONS: Record<number, (state: unknown) => unknown> = {
	/**
	 * 1 → 2: у показників зʼявився РОЗКЛАД причин.
	 *
	 * Старі дні історії лишаються з порожнім розкладом, а не вигаданим. Розписати
	 * «−235» назад на зарплати й утримання неможливо: даних для цього ніколи не
	 * зберігалося. Підказка на таких днях покаже саму різницю — правду, яку вона
	 * показувала й доти, — а не вгадану бухгалтерію.
	 */
	1: (state) => {
		if (!isObject(state)) return state;
		const journal = Array.isArray(state.journal) ? state.journal : [];
		return {
			...state,
			journal: journal.map((day) => (isObject(day) ? { ...day, notes: [] } : day)),
			today: []
		};
	},

	/**
	 * 2 → 3: вольєр дістав суб-модулі, фонд — комору з кормом.
	 *
	 * **Старі вольєри дістають ВСІ модулі**, і це не поблажливість. Доти плата за
	 * утримання йшла за розмір і покривала все разом — фонд уже платив за воду,
	 * рослини й укриття, просто одним числом. Віддати чужій партії порожні вольєри
	 * означало б заднім числом оголосити, що всі тварини роками страждали, і
	 * зустріти гравця стресом, який він не мав шансу передбачити.
	 *
	 * Комора наповнюється на десять днів за поточною кількістю тварин. Нуль
	 * означав би голод у першу ж добу після оновлення — за правилом, якого в тій
	 * партії ще не існувало.
	 */
	2: (state) => {
		if (!isObject(state)) return state;

		const sites = isObject(state.sites) ? state.sites : {};
		const upgraded: Record<string, unknown> = {};
		let mouths = 0;

		for (const [biome, raw] of Object.entries(sites)) {
			if (!isObject(raw)) {
				upgraded[biome] = raw;
				continue;
			}
			const animals = Array.isArray(raw.animals) ? raw.animals : [];
			mouths += animals.filter((animal) => isObject(animal) && animal.stage !== 'released').length;

			upgraded[biome] = {
				...raw,
				enclosures: (Array.isArray(raw.enclosures) ? raw.enclosures : []).map((enclosure) =>
					isObject(enclosure)
						? { ...enclosure, modules: ['water', 'plants', 'shelter'], byWater: false }
						: enclosure
				)
			};
		}

		return { ...state, sites: upgraded, feed: Math.max(10, mouths * 10) };
	},

	/**
	 * 3 → 4: перемоги як стану більше немає — заповідник став пісочницею з віхами.
	 *
	 * Поріг `IMPACT_TO_WIN = 10 000` при випуску в +50 означав ДВІСТІ повернених
	 * тварин, тоді як таймер програшу міряв тридцять діб. Тепер сходинки по
	 * степенях десяти (`milestones.ts`), і вони ЧИСТА ФУНКЦІЯ від користі — саме
	 * тому ця сходинка нічого не додає, а лише прибирає поле.
	 *
	 * Партію, яку встигли виграти, це не кривдить: `victory: true` означало, що
	 * користі понад 10 000, тобто друга віха вже взята, і вона так і покажеться.
	 * Час у такому сейві стояв — після зняття поля він піде далі, і це саме те,
	 * чого пісочниця й хоче.
	 */
	3: (state) => {
		if (!isObject(state)) return state;
		// Імʼя з підкресленням — умова `varsIgnorePattern` у конфігу eslint: поле
		// навмисно відкидається, і директива придушення тут була б зайвою.
		const { victory: _dropped, ...rest } = state;
		return rest;
	},

	/**
	 * 4 → 5: «одужання» стало ЗДОРОВʼЯМ, і шкала поїхала в обидва боки.
	 *
	 * Доти `recovery` лише росло від нуля до одиниці: тварина або лікувалася,
	 * або стояла на місці. Тепер це здоровʼя — воно ще й ПАДАЄ, а на нулі тварина
	 * помирає (`care.ts`).
	 *
	 * Число переноситься як є, і це не спрощення. У старій шкалі одиниця означала
	 * «вилікувана», нуль — «щойно привезена»; у новій одиниця означає «здорова»,
	 * нуль — «мертва». Збіг на верхньому кінці точний, а на нижньому — ні, тож
	 * прибулим із нулем ставиться межа самоодужання: інакше кожна тварина в
	 * старому сейві померла б за десять діб після оновлення, за правилом, якого
	 * в тій партії не існувало.
	 */
	4: (state) => {
		if (!isObject(state)) return state;
		const sites = isObject(state.sites) ? state.sites : {};
		const upgraded: Record<string, unknown> = {};

		for (const [biome, raw] of Object.entries(sites)) {
			if (!isObject(raw)) {
				upgraded[biome] = raw;
				continue;
			}
			const animals = Array.isArray(raw.animals) ? raw.animals : [];
			upgraded[biome] = {
				...raw,
				animals: animals.map((animal) => {
					if (!isObject(animal)) return animal;
					const { recovery, ...rest } = animal;
					const value = typeof recovery === 'number' ? recovery : 0;
					return { ...rest, health: Math.max(0.5, value) };
				})
			};
		}

		return { ...state, sites: upgraded };
	}
};
