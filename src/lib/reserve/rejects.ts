/**
 * Чому хід не пройшов — увесь перелік причин, і жодної логіки.
 *
 * Окремим файлом, бо це СЛОВНИК відмов: він нікого не імпортує й ні на що не
 * спирається. Кожне значення має пару в перекладі (`reserve.reject.<r>`), тож
 * читають цей файл удвох зі словником — а лежачи серед описів тварин, він
 * змушував гортати двісті рядків, щоб знайти список.
 *
 * Кожна відмова НАЗИВАЄ причину. «Не можна» без причини читається як поламана
 * кнопка, а тут кожна заборона — це саме те, чого гра навчає.
 */

export type RejectReason =
	| 'game-over'
	| 'no-money'
	| 'subsidy-mode'
	| 'no-such-animal'
	| 'not-healthy'
	| 'too-stressed'
	| 'not-releasable'
	| 'nobody-to-dismiss'
	| 'no-such-species'
	| 'no-such-enclosure'
	| 'enclosure-taken'
	| 'enclosure-too-small'
	| 'bad-size'
	| 'bad-quality'
	/** Вид не живе в цьому біомі — і саме це гра пояснює, а не обходить. */
	| 'wrong-biome'
	| 'already-sound'
	| 'not-an-upgrade'
	| 'campaign-done'
	/** Нальоту немає — вирішувати нічого. */
	| 'no-raid'
	/** Засідку нема кому влаштувати: патруля немає. */
	| 'no-ranger'
	/** Наступне місце в сітці випало б за межу ділянки. */
	| 'out-of-bounds'
	/** Клітинка вже під іншим вольєром. */
	| 'cell-taken'
	| 'no-such-contract'
	| 'contract-unfinished'
	| 'too-many-contracts'
	/** Такий суб-модуль тут уже стоїть. */
	| 'already-equipped'
	/** Природна вода поруч: водойму копати нема сенсу. */
	| 'water-nearby'
	/** Порцій має бути хоч одна. */
	| 'bad-amount';
