import { browser } from '$app/environment';
import { AVATAR_KEY, isAvatar, normaliseAvatar, randomAvatar } from '$lib/config/avatars';
import { storage } from './storage';

/**
 * АВАТАР ЦЬОГО ГРАВЦЯ — одне джерело на всі екрани.
 *
 * ## Навіщо синглтон, коли є сховище
 *
 * Сховище не реактивне. Доти аватар читали з нього три місця незалежно —
 * конструктор `PlayerIdentity` (лобі), стан сторінки акаунта й ніхто в шапці, —
 * і кожне отримувало значення В МОМЕНТ створення. Тобто вибір у профілі не
 * доходив ні до шапки, ні до відкритого лобі: щоб побачити свій новий аватар,
 * доводилося перезавантажити сторінку.
 *
 * Тут значення живе в `$state`, тож усі, хто його читає, оновлюються разом.
 *
 * ## Випадкова аватарка з першого візиту (рішення автора 2026-09-27, 8-A)
 *
 * «Раз при першому візиті, памʼятається на пристрої, видно в шапці. У профіль не
 * пишеться, поки людина не вибере сама.» Тому значення є завжди, а поряд — `chosen`:
 * чи вибрала людина його сама. Випадкову позначає окремий ключ (`AVATAR_RANDOM_KEY`), а
 * не відсутність вибору: аватарки, збережені старшими збірками, — це саме вибір (тоді
 * у сховище писали лише його), і позначки вони не мають.
 *
 * Значок, якого більше немає (13-A), переходить у тварину того самого кольору одразу
 * під час читання й пишеться назад — мовчки (`normaliseAvatar`).
 *
 * ## Чому це шар СЕРВІСУ, а не контролера
 *
 * Його імпортує шапка, тобто КОЖНА сторінка. Тому тут немає ні мережі, ні
 * `lucide`, ні профілю — лише рядок і сховище: усе, що лежить у цьому чанку,
 * приїжджає кожному відвідувачеві, а бюджет кореневого layout — гейт
 * (`npm run check:build`). Та сама причина, що в `services/accountFlag.ts`.
 *
 * ## Хто джерело правди
 *
 * Акаунт, якщо він є: профіль у базі — те, що видно з будь-якого пристрою.
 * Сховище лишається КЕШЕМ, який читають екрани, що не мають права ходити в
 * мережу (форма входу в кімнату мусить відкриватися з першого дотику). Тому
 * запис тут кличуть двоє: збереження профілю (після вдалого запису в базу) і
 * читання профілю при вході — щоб кеш наздогнав акаунт на новому пристрої.
 */

/** Позначка «аватарку дав перший візит, людина її не вибирала». Префікс додає фасад. */
export const AVATAR_RANDOM_KEY = 'pairs.avatarRandom';

/** Що вертає відкат: і плитка, і чи її вибирали. */
export interface AvatarSnapshot {
	value: string;
	chosen: boolean;
}

class PlayerAvatar {
	/**
	 * Аватар цього пристрою: вибраний або випадковий з першого візиту. Порожньо — лише
	 * до гідрації (пререндер) і без сховища зовсім; тоді шапка показує значок акаунта.
	 */
	value = $state('');
	/** Чи вибрала людина аватарку сама. Лише вибрана їде в профіль (8-A). */
	chosen = $state(false);

	constructor(random: () => number) {
		const start = hydrate(random);
		this.value = start.value;
		this.chosen = start.chosen;
	}

	/** Людина вибрала. Пише і в стан (екран), і у сховище (наступний захід). */
	set(next: string): void {
		if (!isAvatar(next)) return;
		this.value = next;
		this.chosen = true;
		storage.set(AVATAR_KEY, next);
		storage.remove(AVATAR_RANDOM_KEY);
	}

	/** Знімок для відкату невдалого запису профілю (сторінка акаунта). */
	snapshot(): AvatarSnapshot {
		return { value: this.value, chosen: this.chosen };
	}

	/**
	 * Повернути знімок — разом із тим, чи аватарку вибирали: відкат не мусить робити з
	 * випадкової «вибрану», інакше наступне «Зберегти» понесло б її в профіль.
	 */
	restore(snapshot: AvatarSnapshot): void {
		if (snapshot.chosen) return this.set(snapshot.value);
		this.value = normaliseAvatar(snapshot.value);
		this.chosen = false;
		if (this.value === '') {
			storage.remove(AVATAR_KEY);
			storage.remove(AVATAR_RANDOM_KEY);
			return;
		}
		storage.set(AVATAR_KEY, this.value);
		storage.set(AVATAR_RANDOM_KEY, '1');
	}

	/** Аватар для кімнати — будь-який, що є: випадкова теж розрізняє людей у складі. */
	forRoom(): string | undefined {
		return this.value === '' ? undefined : this.value;
	}
}

/**
 * Прочитати сховище — і на першому візиті дати випадкову аватарку. Запис тут — не
 * «зберегти прочитане»: це нова випадкова пара або переведення значка, якого більше
 * немає, і обидва мусять пережити перезавантаження.
 */
function hydrate(random: () => number): AvatarSnapshot {
	if (!browser) return { value: '', chosen: false };
	const saved = storage.get(AVATAR_KEY);
	const value = normaliseAvatar(saved);
	if (value !== '') {
		if (value !== saved) storage.set(AVATAR_KEY, value);
		return { value, chosen: storage.get(AVATAR_RANDOM_KEY) !== '1' };
	}
	const fresh = randomAvatar(random);
	storage.set(AVATAR_KEY, fresh);
	storage.set(AVATAR_RANDOM_KEY, '1');
	return { value: fresh, chosen: false };
}

export const playerAvatar = new PlayerAvatar(Math.random);
