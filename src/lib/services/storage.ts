import { browser } from '$app/environment';

/**
 * Префікс усього, що проєкт кладе в браузер.
 *
 * Експортований, бо ним іменуються не лише ключі сховища: кеші Cache API мусять
 * нести той самий префікс, інакше аварійне скидання не зможе відрізнити СВОЇ
 * кеші від кешів сусідніх проєктів на спільному origin
 * (STORAGE-NAMESPACE-v8 § Крок 5). Одне джерело замість двох, які розійдуться.
 */
export const PREFIX = 'vetcrewgames_';

/**
 * Фасад браузерного сховища (STORAGE-NAMESPACE-v8, Крок 1).
 *
 * Два інваріанти, обидва CRITICAL, і обидва тут раніше не трималися:
 *
 *  1. **Фасад ніколи не кидає.** `localStorage.setItem` кидає
 *     `QuotaExceededError` при переповненні, а в приватному режимі частини
 *     браузерів кидає вже сам доступ до об'єкта. Доти жоден виклик не був
 *     обгорнутий, і найдорожчий шлях був такий: конструктор `Settings`
 *     виконується на імпорті модуля → `storage.get('theme')` кидає → падає
 *     весь застосунок, а не одне збереження. Втратити налаштування прийнятно;
 *     втратити сайт — ні.
 *  2. **`clear()` видаляє лише свої ключі.** Origin спільний із сусідніми
 *     проєктами (реєстр префіксів — у PROJECT-CONTEXT.md), тож
 *     `localStorage.clear()` тут означав би знищення чужих даних.
 *
 * Після першої відмови сховище вимикається до кінця сесії: якщо доступ кидає
 * раз, він кидатиме й далі, а логувати це на кожному записі означає засипати
 * звіт однаковими рядками.
 */

/** Не `import` угорі: `logService` сам читає `sessionStore` звідси — це цикл. */
function warn(message: string, error: unknown): void {
	void import('./logService.svelte').then(({ logService }) => {
		logService.warn('app', `[storage] ${message}`, { error: String(error) });
	});
}

export interface StorageFacade {
	get(key: string): string | null;
	/** `false` означає, що значення НЕ збережено — виклик може повідомити користувача. */
	set(key: string, value: string): boolean;
	remove(key: string): void;
	/** Видаляє лише ключі з префіксом проєкту. */
	clear(): void;
	getJSON<T>(key: string): T | null;
	setJSON(key: string, value: unknown): boolean;
}

function createFacade(name: 'localStorage' | 'sessionStorage'): StorageFacade {
	/** Вимикається назавжди після першої відмови (приватний режим, квота). */
	let available = true;

	/**
	 * Доступ до самого об'єкта теж під try: у Firefox із заблокованими cookie
	 * кидає вже звернення `window.localStorage`, а не лише його методи.
	 */
	function store(): Storage | null {
		if (!browser || !available) return null;
		try {
			return window[name];
		} catch (error) {
			available = false;
			warn(`${name} недоступне — працюємо без нього`, error);
			return null;
		}
	}

	const facade: StorageFacade = {
		get(key) {
			const raw = store();
			if (!raw) return null;
			try {
				return raw.getItem(PREFIX + key);
			} catch (error) {
				available = false;
				warn(`${name} недоступне — працюємо без нього`, error);
				return null;
			}
		},

		set(key, value) {
			const raw = store();
			if (!raw) return false;
			try {
				raw.setItem(PREFIX + key, value);
				return true;
			} catch (error) {
				// `available` знімається ПЕРЕД логуванням: logService дзеркалить
				// буфер у sessionStorage, тож інакше warn нижче знову зайшов би
				// сюди — і так по колу.
				available = false;
				warn(`не вдалося зберегти «${key}» у ${name}`, error);
				return false;
			}
		},

		remove(key) {
			const raw = store();
			if (!raw) return;
			try {
				raw.removeItem(PREFIX + key);
			} catch (error) {
				available = false;
				warn(`не вдалося видалити «${key}» із ${name}`, error);
			}
		},

		clear() {
			const raw = store();
			if (!raw) return;
			try {
				const keys: string[] = [];
				for (let i = 0; i < raw.length; i++) {
					const key = raw.key(i);
					if (key?.startsWith(PREFIX)) keys.push(key);
				}
				keys.forEach((k) => raw.removeItem(k));
			} catch (error) {
				available = false;
				warn(`очищення ${name} не вдалося`, error);
			}
		},

		getJSON<T>(key: string): T | null {
			const raw = facade.get(key);
			if (raw === null) return null;
			try {
				return JSON.parse(raw) as T;
			} catch (error) {
				warn(`не вдалося розібрати «${key}» із ${name}`, error);
				return null;
			}
		},

		setJSON(key, value) {
			return facade.set(key, JSON.stringify(value));
		}
	};

	return facade;
}

export const storage = createFacade('localStorage');
export const sessionStore = createFacade('sessionStorage');
