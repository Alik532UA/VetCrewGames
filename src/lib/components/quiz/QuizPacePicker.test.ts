import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import type { RoomPace } from '$lib/config/quizOnline';
import QuizPacePicker from './QuizPacePicker.svelte';

// `formatFont` приїжджає транзитивно з `$lib/i18n` — підміна, як у `RoundIndicator.test.ts`.
vi.mock('$lib/i18n/index', () => ({
	formatFont: (s: string) => s
}));

/**
 * ШКАЛИ ШВИДКОСТІ — сегментами, і «не обмежений» серед них.
 *
 * Перевіряється те, чого не видно з контролера: що НА ЕКРАНІ вибрано рівно те, що
 * діє, і що кожен вибір віддає швидкість ЦІЛКОМ. Друге — не педантизм: кімната
 * пише налаштування повністю, тож віддана частина стерла б решту.
 *
 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1), усі зроблені: взяти
 * `QUIZ_PACES` замість `ROUND_PACES` у шкалі раунду — червоніє перший пункт і кожен,
 * що звертається до «не обмежений»; віддавати лише змінену шкалу замість
 * `{ ...pace, … }` — третій (раунд) і четвертий (розбір), кожен від своєї шкали;
 * прибрати `disabled` у гостя — останній.
 */
const text = (key: string) => key;

function mount(pace: RoomPace, editable = true) {
	const onpick = vi.fn();
	const view = render(QuizPacePicker, { props: { text, pace, editable, onpick } });
	const radio = (testid: string) => view.getByTestId(testid) as HTMLInputElement;
	return { onpick, radio, view };
}

describe('QuizPacePicker', () => {
	it('у шкалі раунду чотири варіанти, і четвертий — «не обмежений»', () => {
		const { radio } = mount({ round: 'normal', reveal: 'normal' });

		for (const id of ['fast', 'normal', 'slow', 'unlimited']) {
			expect(radio(`quiz-pace-round-${id}-radio`)).toBeTruthy();
		}
		// У шкалі розбору «без межі» немає: табло мусить іти далі само.
		expect(() => radio('quiz-pace-reveal-unlimited-radio')).toThrow();
	});

	it('вибрано рівно те, що стоїть у кімнаті, — в обох шкалах', () => {
		const { radio } = mount({ round: 'unlimited', reveal: 'fast' });

		expect(radio('quiz-pace-round-unlimited-radio').checked).toBe(true);
		expect(radio('quiz-pace-round-normal-radio').checked).toBe(false);
		expect(radio('quiz-pace-reveal-fast-radio').checked).toBe(true);
	});

	it('вибір раунду віддає швидкість цілком', async () => {
		const { onpick, radio } = mount({ round: 'normal', reveal: 'fast' });

		await fireEvent.click(radio('quiz-pace-round-unlimited-radio'));

		expect(onpick).toHaveBeenCalledWith({ round: 'unlimited', reveal: 'fast' });
	});

	it('вибір розбору шкали раунду не чіпає', async () => {
		const { onpick, radio } = mount({ round: 'unlimited', reveal: 'fast' });

		await fireEvent.click(radio('quiz-pace-reveal-slow-radio'));

		expect(onpick).toHaveBeenCalledWith({ round: 'unlimited', reveal: 'slow' });
	});

	it('пояснення «поки кожен не відповість» — лише коли вибрано «не обмежений»', () => {
		const limited = mount({ round: 'slow', reveal: 'normal' });
		expect(limited.view.queryByTestId('quiz-pace-unlimited-text')).toBeNull();
		limited.view.unmount();

		const free = mount({ round: 'unlimited', reveal: 'normal' });
		expect(free.view.getByTestId('quiz-pace-unlimited-text').textContent).toContain(
			'quiz.paceUnlimitedHint'
		);
	});

	it('гість бачить вибір, але не змінює', async () => {
		const { onpick, radio } = mount({ round: 'normal', reveal: 'normal' }, false);

		/*
		 * `:disabled`, а не властивість `.disabled`: вимикає радіокнопку `fieldset`
		 * навколо, а властивість віддзеркалює лише ВЛАСНИЙ атрибут поля й лишається
		 * `false`. Саме на цьому перша редакція тесту й упала — справний код, хибна
		 * перевірка.
		 */
		expect(radio('quiz-pace-round-unlimited-radio').matches(':disabled')).toBe(true);
		await fireEvent.click(radio('quiz-pace-round-unlimited-radio'));
		await fireEvent.click(radio('quiz-pace-reveal-slow-radio'));

		expect(onpick).not.toHaveBeenCalled();
	});
});
