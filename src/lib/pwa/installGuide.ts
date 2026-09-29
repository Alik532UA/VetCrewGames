/**
 * ЯК ВСТАНОВИТИ ЗАСТОСУНОК ВРУЧНУ — інструкція під пристрій і браузер (прохання автора
 * 2026-09-29: «інструкції взяти зі Slovko, там вони перевірені»).
 *
 * ## Звідки тексти і що виправлено
 *
 * Кроки — зі Slovko (`components/pwa/InstallGuide.svelte`). Код звідти не взято, і причина
 * названа: iPad там визначався як компʼютер (iPadOS у Safari звітує `Macintosh`), тож
 * людина читала про «іконку встановлення в адресному рядку», якої в Safari на iPad немає.
 * Відповідь автора A додала те, чого там не було: Safari на Mac, Firefox і вбудовані
 * браузери месенджерів.
 *
 * ## Чому за рядком браузера, а не за можливістю
 *
 * Для РІШЕННЯ «чи вміє» проєкт питає можливість (`canFullscreen`, `canPromptInstall`). Тут
 * інше питання — ЯКИМИ СЛОВАМИ сказати, куди натиснути, — і відповідь на нього є лише в
 * назві браузера: кнопка «Поділитися» в Safari внизу, у Chrome на iPhone — в адресному рядку.
 *
 * Модуль чистий і без значків: тексти — ключі лінивого словника (`i18n/install`), значок —
 * назва, яку перекладає на компонент вікно (`FullscreenOffer.svelte`).
 */

export type Guide =
	| 'ios-safari'
	| 'ios-chrome'
	| 'ios-other'
	| 'ipad-safari'
	| 'android'
	| 'desktop'
	| 'edge'
	| 'mac-safari'
	| 'firefox-desktop'
	| 'in-app';

/** Значок кроку — назва, а не компонент: модуль мусить лишатися чистим. */
export type StepIcon =
	| 'share'
	| 'add'
	| 'dots'
	/** Кнопка встановлення в адресному рядку Chrome: монітор зі стрілкою вниз. */
	| 'install'
	/** Та сама кнопка в Edge: сітка з трьох квадратів і плюса (скарга автора 2026-09-29). */
	| 'installEdge'
	| 'dock'
	| 'browser'
	| 'phone'
	| 'app';

export interface Step {
	/** Ключ у словнику `i18n/install`. */
	text: string;
	icon: StepIcon;
}

export interface GuideText {
	title: string;
	/** Що сказати перед кроками. Для більшості — примітка «одним натиском не можна». */
	note: string;
	steps: readonly Step[];
	warning?: string;
}

/**
 * Вбудовані браузери месенджерів і соцмереж. Вони не встановлюють сайтів узагалі, тож
 * крок там один — відкрити гру в справжньому браузері. Telegram і WhatsApp тут немає: вони
 * відкривають посилання в системному переглядачі, і назви свого в рядку браузера не лишають.
 */
const IN_APP =
	/FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|BytedanceWebview|Snapchat|LinkedInApp|Pinterest/i;

/**
 * Яку інструкцію показати.
 *
 * iPad — за `maxTouchPoints`: Safari на ньому звітує як Mac, а сенсорного екрана в Mac немає.
 */
export function guideFor(userAgent: string, maxTouchPoints: number): Guide {
	if (IN_APP.test(userAgent)) return 'in-app';

	const iPad = /iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
	if (iPad || /iPhone|iPod/.test(userAgent)) {
		if (/CriOS/.test(userAgent)) return 'ios-chrome';
		if (/FxiOS|EdgiOS|OPiOS/.test(userAgent)) return 'ios-other';
		return iPad ? 'ipad-safari' : 'ios-safari';
	}

	if (/Android/.test(userAgent)) return 'android';
	if (/Firefox\//.test(userAgent)) return 'firefox-desktop';
	// Edge малює кнопку встановлення інакше, ніж Chrome, і крок мусить показати саме її.
	if (/Edg\//.test(userAgent)) return 'edge';
	if (/Macintosh/.test(userAgent) && !/Chrome|Chromium|Edg|OPR/.test(userAgent)) {
		return 'mac-safari';
	}
	return 'desktop';
}

const MANUAL = 'install.note.manual';
const OPEN_HOME: Step = { text: 'install.step.openHome', icon: 'phone' };
const ADD_HOME: Step = { text: 'install.step.addHome', icon: 'add' };
const OPEN_APP: Step = { text: 'install.step.openApp', icon: 'app' };
const INSTALL_ICON: Step = { text: 'install.step.installIcon', icon: 'install' };

export const GUIDES: Record<Guide, GuideText> = {
	'ios-safari': {
		title: 'install.title.iphone',
		note: MANUAL,
		steps: [{ text: 'install.step.shareBottom', icon: 'share' }, ADD_HOME, OPEN_HOME]
	},
	'ios-chrome': {
		// Chrome буває й на iPad: назва пристрою тут була б неправдою для половини.
		title: 'install.title.app',
		note: MANUAL,
		steps: [
			{ text: 'install.step.shareAddressBar', icon: 'share' },
			{ text: 'install.step.addHomeChrome', icon: 'add' },
			OPEN_HOME
		],
		warning: 'install.warning.iosChrome'
	},
	'ios-other': {
		title: 'install.title.app',
		note: MANUAL,
		steps: [{ text: 'install.step.shareMenu', icon: 'share' }, ADD_HOME, OPEN_HOME]
	},
	'ipad-safari': {
		title: 'install.title.ipad',
		note: MANUAL,
		steps: [{ text: 'install.step.shareTop', icon: 'share' }, ADD_HOME, OPEN_HOME]
	},
	android: {
		title: 'install.title.android',
		note: MANUAL,
		steps: [
			{ text: 'install.step.dots', icon: 'dots' },
			{ text: 'install.step.addHomeAndroid', icon: 'add' },
			{ text: 'install.step.openHomeAndroid', icon: 'phone' }
		]
	},
	desktop: {
		title: 'install.title.desktop',
		note: MANUAL,
		steps: [INSTALL_ICON, { text: 'install.step.confirm', icon: 'add' }, OPEN_APP]
	},
	edge: {
		title: 'install.title.desktop',
		note: MANUAL,
		steps: [
			{ text: 'install.step.installIcon', icon: 'installEdge' },
			{ text: 'install.step.confirm', icon: 'add' },
			OPEN_APP
		]
	},
	'mac-safari': {
		title: 'install.title.mac',
		note: MANUAL,
		steps: [
			{ text: 'install.step.macFile', icon: 'dock' },
			{ text: 'install.step.macAdd', icon: 'add' },
			{ text: 'install.step.openDock', icon: 'app' }
		]
	},
	'firefox-desktop': {
		title: 'install.title.desktop',
		note: 'install.note.firefox',
		steps: [{ text: 'install.step.openChromeEdge', icon: 'browser' }, INSTALL_ICON, OPEN_APP]
	},
	'in-app': {
		title: 'install.title.inApp',
		note: 'install.note.inApp',
		steps: [
			{ text: 'install.step.inAppMenu', icon: 'dots' },
			{ text: 'install.step.inAppOpen', icon: 'browser' },
			{ text: 'install.step.inAppAgain', icon: 'app' }
		]
	}
};
