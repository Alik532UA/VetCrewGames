import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeCode } from '$lib/net/rtdbRoom';

/**
 * КОД КІМНАТИ: одні цифри, і межі поля збігаються з межами генератора.
 *
 * ## Чому це окремий інваріант
 *
 * Довжина коду живе у ДВОХ файлах, і не з недогляду: генератор — у мережевому
 * шарі (`net/rtdbRoom.ts`), а межі поля введення — у формі
 * (`components/pairs/OnlineGate.svelte`), яка про мережу навмисно не знає нічого.
 * Тобто числа мусять збігатися, а спільного джерела в них бути не може.
 *
 * Розходження тут дає найгірший різновид дефекту: код згенеровано правильно, у
 * буфері він правильний, а кнопка «зайти» лишається сірою — або, навпаки, поле
 * ріже останню цифру. Виглядає це як зламана кімната, а причина в числі з іншого
 * файлу.
 *
 * ## Що саме стверджується
 *
 * Не «числа рівні», а те, що поле приймає ВСЯКИЙ код, який генератор може
 * видати: від найкоротшого публічного до найдовшого приватного.
 */

const read = (path: string) => readFileSync(path, 'utf8');

const number = (source: string, name: string): number => {
	const found = new RegExp(`const ${name} = (\\d+)`).exec(source);
	expect(found, `${name} не знайдено — інваріант дивиться не туди`).not.toBeNull();
	return Number(found?.[1]);
};

describe('код кімнати', () => {
	const net = read('src/lib/net/rtdbRoom.ts');
	const gate = read('src/lib/components/pairs/OnlineGate.svelte');

	const publicLength = number(net, 'PUBLIC_CODE_LENGTH');
	const publicMax = number(net, 'PUBLIC_CODE_MAX');
	const privateLength = number(net, 'PRIVATE_CODE_LENGTH');
	const fieldMin = number(gate, 'CODE_MIN');
	const fieldMax = number(gate, 'CODE_MAX');

	it('перевірка жива: усі пʼять чисел знайдено', () => {
		for (const value of [publicLength, publicMax, privateLength, fieldMin, fieldMax]) {
			expect(Number.isInteger(value)).toBe(true);
			expect(value).toBeGreaterThan(0);
		}
	});

	it('поле приймає найкоротший код, який генератор видає', () => {
		// Публічна кімната починає з двох цифр — саме цю довжину людина й вводить
		// найчастіше, бо публічних кімнат більшість.
		expect(fieldMin).toBe(publicLength);
	});

	it('поле приймає найдовший код, який генератор видає', () => {
		// Найдовший можливий — або виросла публічна, або приватна. Поле мусить
		// вміщати обидва: `maxlength` менший за це різав би останню цифру.
		expect(fieldMax).toBe(Math.max(publicMax, privateLength));
	});

	it('розряд публічного коду росте, а не стоїть', () => {
		// Дві цифри — сто кімнат. Без росту це стеля, за якою створення просто
		// перестає працювати; із ростом — рідкісна подія, записана в журнал.
		expect(publicMax).toBeGreaterThan(publicLength);
	});

	/**
	 * Приватний код мусить бути ДОВШИМ за публічний.
	 *
	 * Це не смак: у публічної кімнати код не секрет (вона в переліку разом із ним),
	 * а в приватної він І Є пароль. Однакова довжина означала б, що приватну
	 * кімнату перебирають так само легко, як публічну, — тобто приватності немає.
	 */
	it('приватний код довший за публічний', () => {
		expect(privateLength).toBeGreaterThan(publicLength);
	});

	/**
	 * ЛІТЕР У КОДІ НЕМА — ні в генераторі, ні в полі.
	 *
	 * `autocapitalize="characters"` у полі лишився б від літерного коду й на
	 * телефоні перемикав би клавіатуру у верхній регістр там, де потрібні цифри.
	 * Це не помилка коду, а зламана клавіатура — саме той різновид, який не падає.
	 */
	it('поле налаштоване на цифри, а не на літери', () => {
		expect(gate).toContain('inputmode="numeric"');
		expect(gate, 'autocapitalize лишився від літерного коду').not.toContain('autocapitalize');
		expect(net, 'алфавіт коду — самі цифри').toContain("const DIGITS = '0123456789'");
	});

	/**
	 * ТОЧНІ МЕЖІ генератора, а не сотня кидків.
	 *
	 * Джерело випадковості передається, тож поведінку можна стверджувати
	 * однозначно — і саме там, де живе класична помилка на одиницю. Той самий
	 * спосіб, що в `pickOne` та `randomCrewName`.
	 */
	it('генератор віддає рівно задану кількість цифр', () => {
		expect(makeCode(() => 0, publicLength)).toBe('0'.repeat(publicLength));
		expect(makeCode(() => 0.999999, privateLength)).toBe('9'.repeat(privateLength));
		for (const length of [publicLength, publicMax, privateLength]) {
			expect(makeCode(() => 0.5, length)).toMatch(new RegExp(`^\\d{${length}}$`));
		}
	});

	/**
	 * Провідний нуль ЗБЕРІГАЄТЬСЯ.
	 *
	 * «07» — чинний двоцифровий код, і найдешевший спосіб його зламати —
	 * перетворити рядок у число десь по дорозі. Тому тут стверджується саме рядок,
	 * а поле лишається `type="text"` (див. коментар у формі).
	 */
	it('провідний нуль лишається на місці', () => {
		expect(makeCode(() => 0, 2)).toBe('00');
		expect(makeCode(() => 0, 2).length).toBe(2);
	});
});
