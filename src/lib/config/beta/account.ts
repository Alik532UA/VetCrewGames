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
			testid: 'account-submit-btn'
		},
		{
			id: 'account_2',
			category: { uk: 'Реєстрація', en: 'Registering' },
			text: {
				uk: 'Спробуйте зареєструватися поштою, яка вже зайнята. Мусить бути порада «зайти в наявний», а не загальне «не вдалося».',
				en: 'Try registering with an email that is already taken. It must advise “sign in to an existing one”, not a generic failure.'
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
