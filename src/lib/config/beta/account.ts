import type { BetaTab } from '../betaChecks';

/**
 * Акаунт, профіль і підписки.
 *
 * Тут майже все — `manual`, і причина конкретна: перевіряти треба саме те, чого
 * автотест не бачить. Правила бази вже доведені гейтом (91 випадок), програма
 * партій — тестами; лишається те, що живе між двома людьми й двома пристроями:
 * чи справді `uid` не змінився після реєстрації, чи справді взаємна підписка дає
 * кімнати друзів угорі списку.
 *
 * Перший пункт найдорожчий. Реєстрація — це `linkWithCredential`, тобто
 * привʼязка до НАЯВНОГО анонімного входу. Якщо вона колись стане
 * `createUserWithEmailAndPassword`, усе працюватиме як раніше, крім одного:
 * кімнати й підписки лишаться під старим `uid`. Це найтихіший різновид дефекту —
 * ніщо не падає, просто зникає минуле.
 */
export const accountTab: BetaTab = {
	id: 'account',
	title: { uk: 'Акаунт і друзі', en: 'Account and friends' },
	routes: ['account'],
	checks: [
		{
			id: 'account_1',
			category: { uk: 'Реєстрація', en: 'Registering' },
			text: {
				uk: 'Створіть кімнату анонімно, вийдіть із неї, потім зареєструйтеся поштою. Рядок «продовжити партію» мусить лишитися: `uid` не змінився.',
				en: 'Create a room anonymously, leave it, then register with an email. The “resume the game” row must stay: the uid did not change.'
			},
			coverage: 'manual',
			// Локатор — САМА кнопка «Зареєструватись». Доти тут стояв
			// `account-submit-btn`: одна кнопка, чий підпис мінявся від
			// сегментованого вибору режиму. Вибору режиму більше немає (див.
			// `components/auth/AuthForm.svelte`), і намір тепер називає кнопка.
			testid: 'auth-register-btn'
		},
		{
			id: 'account_2',
			category: { uk: 'Реєстрація', en: 'Registering' },
			text: {
				uk: 'Спробуйте зареєструватися поштою, яка вже зайнята. Мусить бути порада натиснути «Увійти», а не загальне «не вдалося».',
				en: 'Try registering with an email that is already taken. It must advise pressing “Sign in”, not a generic failure.'
			},
			coverage: 'manual',
			testid: 'account-error-text'
		},
		{
			id: 'account_3',
			category: { uk: 'Профіль', en: 'Profile' },
			text: {
				uk: 'Введіть у псевдонім великі літери й кирилицю. Поле мусить лишити тільки малі латинські, цифри й підкреслення — одразу, під час набору.',
				en: 'Type capitals and Cyrillic into the handle. The field must keep only lower-case Latin letters, digits and underscores — right as you type.'
			},
			coverage: 'manual',
			testid: 'account-handle-input'
		},
		{
			id: 'account_4',
			category: { uk: 'Профіль', en: 'Profile' },
			text: {
				uk: 'Займіть псевдонім, який уже є в іншого. Мусить бути відмова, а профіль — лишитися незмінним.',
				en: 'Claim a handle somebody else already has. It must refuse, and the profile must stay unchanged.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'account-handle-taken-text'
		},
		{
			id: 'account_5',
			category: { uk: 'Пошук і підписки', en: 'Search and follows' },
			text: {
				uk: 'Знайдіть другого гравця за початком псевдоніма (щонайменше дві літери) і підпишіться. У нього в списку підписок вас поки НЕ мусить бути.',
				en: 'Find the second player by the start of their handle (at least two letters) and follow them. You must NOT yet appear in their own following list.'
			},
			coverage: 'manual',
			testid: 'account-search-input'
		},
		{
			id: 'account_6',
			category: { uk: 'Пошук і підписки', en: 'Search and follows' },
			text: {
				uk: 'Підпишіться назустріч із другого пристрою. В обох мусить зʼявитися позначка «взаємно» — саме вона й означає друзів.',
				en: 'Follow back from the second device. The “mutual” mark must appear on both — that is exactly what friends means.'
			},
			coverage: 'manual',
			testid: 'account-following-list'
		},
		{
			id: 'account_7',
			category: { uk: 'Кімнати друзів', en: 'Friends’ rooms' },
			text: {
				uk: 'Маючи взаємну підписку, створіть відкриту кімнату на одному пристрої. На другому вона мусить стояти ОКРЕМОЮ групою «Кімнати друзів» над рештою.',
				en: 'With a mutual follow in place, create an open room on one device. On the other it must sit in a SEPARATE “Friends’ rooms” group above the rest.'
			},
			coverage: 'manual',
			testid: 'pairs-friend-rooms-list'
		},
		{
			id: 'account_8',
			category: { uk: 'Приватність', en: 'Privacy' },
			text: {
				uk: 'Вимкніть «Показувати мене в пошуку» й пошукайте себе з другого пристрою за початком псевдоніма. Вас НЕ мусить бути видно — межу тримає правило бази, а не екран.',
				en: 'Turn off “Show me in search” and look for yourself from the second device by the start of your handle. You must NOT be found — the boundary is held by the database rule, not the screen.'
			},
			negative: true,
			coverage: 'manual',
			// Локатор із `*`: три перемикачі малює один `{#each}`, тож у розмітці стоїть
			// шаблон `account-privacy-{id}-btn`. Гейт чеклиста саме так і збирає
			// динамічні локатори — підстановкою зірки (`betaChecks.test.ts`).
			testid: 'account-privacy-*-btn'
		},
		{
			id: 'account_9',
			category: { uk: 'Приватність', en: 'Privacy' },
			text: {
				uk: 'Вимкніть «Дозволяти підписуватися на мене» й спробуйте підписатися з другого пристрою. Мусить бути відмова з підказкою, а не мовчазна кнопка.',
				en: 'Turn off “Let others follow me” and try to follow from the second device. It must refuse with a hint, not sit there silently.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'account-privacy-*-btn'
		},
		{
			id: 'account_10',
			category: { uk: 'Таблиця лідерів', en: 'Leaderboard' },
			text: {
				uk: 'Наберіть щонайменше 50 очок і відкрийте акаунт: ваш рядок мусить зʼявитися в таблиці з тим самим імʼям, аватаром і прапором, що в профілі.',
				en: 'Score at least 50 points and open the account: your row must appear on the board with the same name, avatar and flag as in the profile.'
			},
			coverage: 'manual',
			testid: 'account-board-list'
		},
		{
			id: 'account_11',
			category: { uk: 'Таблиця лідерів', en: 'Leaderboard' },
			text: {
				uk: 'Вимкніть «Показувати мене в таблиці лідерів». Ваш рядок мусить зникнути й НЕ повернутися після наступної партії.',
				en: 'Turn off “Show me on the leaderboard”. Your row must disappear and must NOT come back after the next game.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'account-privacy-*-btn'
		},
		{
			id: 'account_12',
			category: { uk: 'Таблиця лідерів', en: 'Leaderboard' },
			text: {
				uk: 'Маючи взаємну підписку, відкрийте вкладку «Друзі» в таблиці. Там мусять бути лише взаємні підписки — односторонньої там бути не мусить.',
				en: 'With a mutual follow in place, open the “Friends” tab on the board. Only mutual follows may be there — a one-way follow must not.'
			},
			coverage: 'manual',
			testid: 'account-board-friends-btn'
		},
		{
			id: 'account_13',
			category: { uk: 'Рахунок в акаунті', en: 'Score in the account' },
			text: {
				uk: 'Наберіть очок анонімно, потім зареєструйтеся. Рахунок у шапці мусить лишитися тим самим: анонімний доробок зливається з акаунтом.',
				en: 'Score some points anonymously, then register. The score in the header must stay the same: the anonymous progress merges into the account.'
			},
			coverage: 'manual',
			testid: 'auth-register-btn'
		},
		{
			id: 'account_14',
			category: { uk: 'Рахунок в акаунті', en: 'Score in the account' },
			text: {
				uk: 'Увійдіть тим самим акаунтом на другому пристрої. Рахунок і рекорди мусять приїхати; награне на першому — доїхати, поки другий відкритий.',
				en: 'Sign in with the same account on the second device. The score and records must arrive; what you play on the first must reach the second while it is open.'
			},
			coverage: 'manual',
			testid: 'auth-login-btn'
		},
		{
			id: 'account_15',
			category: { uk: 'Рахунок в акаунті', en: 'Score in the account' },
			text: {
				uk: 'Вийдіть з акаунта. Рахунок у шапці мусить стати нулем, а заповідник — початися заново: інакше рахунок можна було б переписати в новий акаунт.',
				en: 'Sign out. The score in the header must drop to zero and the reserve must start over: otherwise a score could be copied into a new account.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'account-leave-btn'
		},
		{
			id: 'account_16',
			category: { uk: 'Вихід', en: 'Signing out' },
			text: {
				uk: 'Вийдіть з акаунта. Сайт мусить лишитися робочим — перелік кімнат читається, кімнату можна створити: вихід одразу вертає анонімний вхід.',
				en: 'Sign out. The site must stay working — the room list reads, a room can be created: signing out immediately returns to anonymous.'
			},
			coverage: 'manual',
			testid: 'account-leave-btn'
		}
	]
};
