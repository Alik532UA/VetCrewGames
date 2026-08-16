import { browser } from '$app/environment';

/**
 * Повноекранний режим — і його підробка для iOS.
 *
 * Винесено з шапки не заради розміру: це шістдесят рядків умовлянь із
 * браузерним API, префіксами `webkit` і винятками, і до самої шапки вони
 * стосунку не мають. Шапці треба лише «зараз повний екран чи ні» і «перемкни».
 *
 * **iPhone не вміє Fullscreen API для елементів узагалі.** Тому там одразу
 * підробка: атрибут `data-fake-fullscreen` на `<html>`, а решту робить CSS у
 * `global.css`. Той самий шлях — запасний і для всіх інших: якщо справжній
 * запит відхилено, ми не лишаємо користувача ні з чим.
 */

interface FullscreenDocument extends Document {
	webkitFullscreenElement?: Element;
	webkitExitFullscreen?: () => Promise<void>;
}

interface FullscreenHTMLElement extends HTMLElement {
	webkitRequestFullscreen?: () => Promise<void>;
}

const FAKE_ATTRIBUTE = 'data-fake-fullscreen';

const isIOS = () =>
	browser && /iPad|iPhone|iPod/.test(navigator.userAgent);

class FullscreenState {
	/** Чи зараз повний екран — справжній або підроблений. */
	active = $state(false);

	#setFake(on: boolean) {
		const root = document.documentElement;
		if (on) root.setAttribute(FAKE_ATTRIBUTE, 'true');
		else root.removeAttribute(FAKE_ATTRIBUTE);
		this.active = on;
	}

	toggle(): void {
		if (!browser) return;

		/*
		 * Підробка активна — вимикаємо саме її, ким би ми не були.
		 *
		 * Перевірка мусить іти ПЕРШОЮ. Доти вона стояла всередині гілки для iOS,
		 * і на комп'ютері з підробки не було виходу взагалі: `fullscreenElement`
		 * при ній порожній, тож кнопка знову просила справжній повний екран —
		 * діставала ту саму відмову й знову вмикала підробку. Стан, у який можна
		 * лише зайти.
		 */
		if (document.documentElement.hasAttribute(FAKE_ATTRIBUTE)) {
			this.#setFake(false);
			return;
		}

		if (isIOS()) {
			this.#setFake(true);
			return;
		}

		const doc = document as FullscreenDocument;
		const root = document.documentElement as FullscreenHTMLElement;

		if (doc.fullscreenElement || doc.webkitFullscreenElement) {
			const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
			if (exit) exit.call(doc);
			this.#setFake(false);
			return;
		}

		const request = root.requestFullscreen || root.webkitRequestFullscreen;
		// Відмову теж треба відпрацювати: браузер може не дати повний екран без
		// жесту, який він визнає, і тоді підробка — єдине, що лишається.
		if (request) request.call(root).catch(() => this.#setFake(true));
		else this.#setFake(true);
	}

	/**
	 * Стежити за виходом ЗЗОВНІ — клавішею Esc або системною кнопкою. Повертає
	 * прибирання: життєвий цикл веде компонент, бо тут `$effect` недоступний
	 * (module-level singleton, SVELTE-CORE-v8 § 2.6).
	 */
	watch(): () => void {
		if (!browser) return () => {};

		const sync = () => {
			const doc = document as FullscreenDocument;
			const native = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
			this.active = native || document.documentElement.hasAttribute(FAKE_ATTRIBUTE);
		};

		document.addEventListener('fullscreenchange', sync);
		document.addEventListener('webkitfullscreenchange', sync);
		return () => {
			document.removeEventListener('fullscreenchange', sync);
			document.removeEventListener('webkitfullscreenchange', sync);
		};
	}
}

export const fullscreen = new FullscreenState();
