export const reserve = {
	// Заголовок і три числа, за якими стежить гравець.
	'reserve.title': 'Заповідник',
	'reserve.day': 'День',
	'reserve.budget': 'Бюджет',
	// Головний показник гри. Не «репутація» і не «очки»: назва має нагадувати,
	// заради чого все затівалося.
	'reserve.impact': 'Користь планеті',

	// Підписи для читалки — дієслово-дія, а не назва стану (ACCESSIBILITY-v8 § 4.1).
	'reserve.speed.pause': 'Зупинити час',
	'reserve.speed.x1': 'Звичайна швидкість',
	'reserve.speed.x2': 'Подвійна швидкість',
	'reserve.speed.x5': "П'ятикратна швидкість",

	'reserve.acquire': 'Прийняти тварину',
	'reserve.origin.official': 'Купити офіційно',
	'reserve.origin.black-market': 'Чорний ринок',
	'reserve.origin.rescue': 'Забрати з біди',
	'reserve.origin.official.hint': 'Дорого й законно. У природу таку не випустиш.',
	'reserve.origin.black-market.hint': 'Дешево — за рахунок того, що хтось її звідти забрав.',
	'reserve.origin.rescue.hint': 'Сама тварина безкоштовна, платиш за дорогу.',

	'reserve.staff': 'Персонал',
	'reserve.staff.vet': 'Ветеринари',
	'reserve.staff.keeper': 'Доглядачі',
	'reserve.hire': 'Найняти',
	'reserve.dismiss': 'Звільнити',

	'reserve.animals': 'Мешканці',
	'reserve.empty': 'Заповідник поки що порожній.',
	'reserve.stage.recovering': 'Одужує',
	'reserve.stage.healthy': 'Здорова',
	'reserve.stage.released': 'На волі',
	'reserve.recovery': 'Одужання',
	'reserve.stress': 'Стрес',
	'reserve.captiveBorn': 'Народжена в неволі',
	'reserve.release': 'Випустити в природу',

	'reserve.subsidy': 'Субсидія: годування й ліки тривають, розширення заблоковане.',
	'reserve.gameOver': 'Заповідник шкодить більше, ніж допомагає. Партію завершено.',
	'reserve.newGame': 'Почати заново',
	'reserve.saveBroken': 'Збереження не вдалося прочитати — почато нову партію.',
	'reserve.saveFuture': 'Збереження з новішої версії гри. Оновіть сторінку.',
	'reserve.saveFailed': 'Партія не зберігається: браузер не дає доступу до сховища.',

	// Кожна відмова пояснює ПРИЧИНУ. «Не можна» без причини читається як
	// поламана кнопка, а тут кожна заборона — це саме те, чого гра навчає.
	'reserve.reject.no-money': 'Не вистачає грошей.',
	'reserve.reject.subsidy-mode': 'Поки бюджет у мінусі, розширюватися не можна.',
	'reserve.reject.not-healthy': 'Тварина ще не одужала.',
	'reserve.reject.not-releasable': 'Народжена в неволі в природі не виживе.',
	'reserve.reject.too-stressed': 'Тварина надто налякана, щоб її випускати.',
	'reserve.reject.nobody-to-dismiss': 'Звільняти нікого.',
	'reserve.reject.no-such-animal': 'Такої тварини вже немає.',
	'reserve.reject.game-over': 'Партію завершено.'
} as const;
