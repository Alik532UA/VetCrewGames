import { beforeEach, describe, expect, it, vi } from 'vitest';
import { animals } from '$lib/config/population-game';
import {
	BIOMES,
	CONTINENTS,
	buildHabitatRound,
	habitatEntries
} from '$lib/config/habitat-game';
import { uk } from '$lib/i18n/translations/uk';

const settingsMock = { addScore: vi.fn() };
vi.mock('$lib/services/settings.svelte', () => ({ settings: settingsMock }));

const { HabitatGameController } = await import('./habitatGame.svelte');

describe('дані «Де живем?»', () => {
	const ids = new Set(animals.map((animal) => animal.id));

	it('перевірка жива: записи знайдено', () => {
		expect(habitatEntries.length).toBeGreaterThan(5);
	});

	it('кожна тварина є в каталозі', () => {
		const missing = habitatEntries
			.filter((entry) => !ids.has(entry.animalId))
			.map((entry) => entry.animalId);
		expect(missing, `немає в population-game.ts: ${missing.join(', ')}`).toEqual([]);
	});

	it('кожен запис має відповідь в обох підрежимах', () => {
		// Запис без відповіді дав би питання, на яке неможливо відповісти;
		// контролер такий пропускає, але саме до цього доводити не варто.
		const empty = habitatEntries
			.filter((entry) => entry.continents.length === 0 || entry.biomes.length === 0)
			.map((entry) => entry.animalId);
		expect(empty, `порожній підрежим: ${empty.join(', ')}`).toEqual([]);
	});

	it('усі значення належать відомим спискам', () => {
		const bad: string[] = [];
		for (const entry of habitatEntries) {
			for (const value of entry.continents)
				if (!CONTINENTS.includes(value)) bad.push(`${entry.animalId}: континент ${value}`);
			for (const value of entry.biomes)
				if (!BIOMES.includes(value)) bad.push(`${entry.animalId}: біом ${value}`);
		}
		expect(bad, bad.join('\n')).toEqual([]);
	});

	it('у відповіді немає дублікатів', () => {
		const bad = habitatEntries
			.filter(
				(entry) =>
					new Set(entry.continents).size !== entry.continents.length ||
					new Set(entry.biomes).size !== entry.biomes.length
			)
			.map((entry) => entry.animalId);
		expect(bad, `дублікати у відповіді: ${bad.join(', ')}`).toEqual([]);
	});

	it('кожен ключ підпису й примітки є у словнику', () => {
		const keys = [
			...CONTINENTS.map((c) => `habitat.continent.${c}`),
			...BIOMES.map((b) => `habitat.biome.${b}`),
			...habitatEntries.map((entry) => entry.noteKey).filter(Boolean)
		] as string[];
		const missing = keys.filter((key) => !(key in uk));
		expect(missing, `ключів немає в перекладах: ${missing.join(', ')}`).toEqual([]);
	});

	it('buildHabitatRound() віддає варіанти того підрежиму, який попросили', () => {
		const entry = habitatEntries[0];
		expect(buildHabitatRound(entry, 'continents')!.options).toEqual(CONTINENTS);
		expect(buildHabitatRound(entry, 'biomes')!.options).toEqual(BIOMES);
	});
});

describe('HabitatGameController', () => {
	beforeEach(() => settingsMock.addScore.mockReset());

	const started = (mode: 'continents' | 'biomes' = 'continents', rounds = 10) => {
		const game = new HabitatGameController(rounds);
		game.chooseMode(mode);
		return game;
	};

	it('до вибору підрежиму раунду немає — це стартовий екран', () => {
		const game = new HabitatGameController();
		expect(game.mode).toBeNull();
		expect(game.round).toBeNull();
		expect(game.gameOver, 'порожній екран — не кінець гри').toBe(false);
	});

	it('вибір підрежиму запускає партію', () => {
		const game = started('biomes');
		expect(game.mode).toBe('biomes');
		expect(game.round).not.toBeNull();
		expect(game.round!.options).toEqual(BIOMES);
	});

	it('кнопка перевірки мовчить, доки нічого не обрано', () => {
		const game = started();
		expect(game.canCheck).toBe(false);

		game.toggle(game.round!.correct[0]);
		expect(game.canCheck).toBe(true);
	});

	it('повторний клік по варіанту знімає вибір', () => {
		const game = started();
		const option = game.round!.correct[0];

		game.toggle(option);
		game.toggle(option);

		expect(game.selected).toEqual([]);
	});

	it('точна відповідь дає очко', () => {
		const game = started();
		game.round!.correct.forEach((option) => game.toggle(option));

		game.check();

		expect(game.outcome).toBe('correct');
		expect(game.sessionScore).toBe(1);
		expect(settingsMock.addScore).toHaveBeenCalledWith(1);
		expect(game.roundResults).toEqual(['correct']);
	});

	/**
	 * Найтонше місце гри. Неповна відповідь — не те саме, що неправильна:
	 * гравець не помилився, він не дорахував. Очка за неї немає, але й
	 * «не там» вона не заслуговує.
	 */
	it('неповна відповідь дає partial і не дає очка', () => {
		const game = started();
		const multi = () => game.round!.correct.length > 1;
		// Знаходимо раунд, де правильних відповідей більше однієї.
		let guard = 0;
		while (!multi() && guard++ < 30) game.nextRound();
		expect(multi(), 'у даних немає жодного питання з кількома відповідями').toBe(true);

		game.toggle(game.round!.correct[0]);
		game.check();

		expect(game.outcome).toBe('partial');
		expect(game.sessionScore).toBe(0);
		expect(settingsMock.addScore).not.toHaveBeenCalled();
	});

	it('зайвий варіант робить відповідь неправильною', () => {
		const game = started();
		const wrong = game.round!.options.find((option) => !game.round!.correct.includes(option))!;
		game.round!.correct.forEach((option) => game.toggle(option));
		game.toggle(wrong);

		game.check();

		expect(game.outcome).toBe('incorrect');
		expect(game.sessionScore).toBe(0);
	});

	it('після перевірки вибір заморожується', () => {
		const game = started();
		game.toggle(game.round!.correct[0]);
		game.check();
		const frozen = [...game.selected];

		game.toggle(game.round!.options[0]);
		game.check();

		expect(game.selected).toEqual(frozen);
		expect(game.roundResults, 'повторна перевірка не має додавати результат').toHaveLength(1);
	});

	it('наступний раунд очищує вибір і знімає перевірку', () => {
		const game = started();
		game.toggle(game.round!.correct[0]);
		game.check();

		game.nextRound();

		expect(game.selected).toEqual([]);
		expect(game.checked).toBe(false);
		expect(game.outcome).toBeNull();
	});

	it('тварини не повторюються в межах партії', () => {
		const game = started('continents', 6);
		const seen = [game.round!.animal.id];
		for (let i = 1; i < 6; i++) {
			game.nextRound();
			seen.push(game.round!.animal.id);
		}
		expect(new Set(seen).size, `повтор: ${seen.join(', ')}`).toBe(seen.length);
	});

	it('після останнього раунду партія завершується', () => {
		const game = started('continents', 2);
		game.nextRound();
		expect(game.gameOver).toBe(false);

		game.nextRound();

		expect(game.gameOver).toBe(true);
		expect(game.round).toBeNull();
	});

	it('reset() повертає на стартовий екран, а не в новий раунд', () => {
		// Саме там міняється підрежим — інакше перемкнути його було б нічим.
		const game = started('biomes', 2);
		game.toggle(game.round!.correct[0]);
		game.check();

		game.reset();

		expect(game.mode).toBeNull();
		expect(game.round).toBeNull();
		expect(game.gameOver).toBe(false);
		expect(game.sessionScore).toBe(0);
	});
});
