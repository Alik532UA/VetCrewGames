// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GUIDES, guideFor, type Guide } from './installGuide';

/**
 * ЯКУ ІНСТРУКЦІЮ ВСТАНОВЛЕННЯ ПОКАЗАТИ (прохання автора 2026-09-29, відповідь 5 — «A»:
 * інструкції Slovko з виправленим iPad, плюс Safari на Mac, Firefox і месенджери).
 *
 * Рядки браузерів — справжні, а не вигадані: саме на справжніх Slovko помилявся (iPad у
 * Safari звітує `Macintosh`, і людина читала про іконку, якої в Safari немає).
 *
 * Зворотні експерименти: iPad без `maxTouchPoints` — червоніє «iPad у Safari»; перевірка
 * Firefox до Android — червоніє «Firefox на Android»; месенджер після iPhone — червоніє
 * «Instagram».
 */

const UA = {
	iphoneSafari:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
	iphoneChrome:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.46 Mobile/15E148 Safari/604.1',
	iphoneFirefox:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15',
	iphoneEdge:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/129.0.2792.84 Version/18.0 Mobile/15E148 Safari/604.1',
	/** iPadOS у Safari — «компʼютерний» рядок, і відрізняє його лише сенсорний екран. */
	macLikeSafari:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
	ipadChrome:
		'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.46 Mobile/15E148 Safari/604.1',
	androidChrome:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
	androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0',
	samsung:
		'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
	windowsChrome:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
	windowsEdge:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
	macEdge:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
	macChrome:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
	windowsFirefox:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
	macFirefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:131.0) Gecko/20100101 Firefox/131.0',
	instagram:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.25.108 (iPhone15,2; iOS 18_0; uk_UA; uk)',
	facebookAndroid:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.47.109;]',
	tiktok:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 trill_2023509030 BytedanceWebview/d8a21c6 musical_ly_2023509030'
};

const cases: Array<[string, string, number, Guide]> = [
	['iPhone у Safari', UA.iphoneSafari, 5, 'ios-safari'],
	['iPhone у Chrome', UA.iphoneChrome, 5, 'ios-chrome'],
	['iPhone у Firefox', UA.iphoneFirefox, 5, 'ios-other'],
	['iPhone в Edge', UA.iphoneEdge, 5, 'ios-other'],
	['iPad у Safari', UA.macLikeSafari, 5, 'ipad-safari'],
	['iPad у Chrome', UA.ipadChrome, 5, 'ios-chrome'],
	['Safari на Mac', UA.macLikeSafari, 0, 'mac-safari'],
	['Chrome на Android', UA.androidChrome, 5, 'android'],
	['Firefox на Android', UA.androidFirefox, 5, 'android'],
	['Samsung Internet', UA.samsung, 5, 'android'],
	['Chrome на Windows', UA.windowsChrome, 0, 'desktop'],
	['Edge на Windows', UA.windowsEdge, 0, 'edge'],
	['Edge на Mac', UA.macEdge, 0, 'edge'],
	['Chrome на Mac', UA.macChrome, 0, 'desktop'],
	['Firefox на Windows', UA.windowsFirefox, 0, 'firefox-desktop'],
	['Firefox на Mac', UA.macFirefox, 0, 'firefox-desktop'],
	['Instagram', UA.instagram, 5, 'in-app'],
	['Facebook на Android', UA.facebookAndroid, 5, 'in-app'],
	['TikTok', UA.tiktok, 5, 'in-app']
];

describe('яка інструкція', () => {
	for (const [name, ua, touch, expected] of cases) {
		it(`${name} → ${expected}`, () => {
			expect(guideFor(ua, touch)).toBe(expected);
		});
	}
});

describe('інструкції', () => {
	it('перевірка жива: кожна інструкція має приклад вище', () => {
		const covered = new Set(cases.map(([, , , guide]) => guide));
		expect([...covered].sort()).toEqual(Object.keys(GUIDES).sort());
	});

	it('у кожної — заголовок, вступ і щонайменше три кроки', () => {
		for (const [guide, text] of Object.entries(GUIDES)) {
			expect(text.title, guide).toMatch(/^install\.title\./);
			expect(text.note, guide).toMatch(/^install\.note\./);
			expect(text.steps.length, guide).toBeGreaterThanOrEqual(3);
		}
	});

	it('Chrome на iPhone — із попередженням про меню «три крапки» (зі Slovko)', () => {
		expect(GUIDES['ios-chrome'].warning).toBe('install.warning.iosChrome');
	});

	it('Edge — власна іконка встановлення (сітка з плюсом), Chrome — монітор зі стрілкою', () => {
		expect(GUIDES.edge.steps[0].icon).toBe('installEdge');
		expect(GUIDES.desktop.steps[0].icon).toBe('install');
	});

	it('iPad — кнопка «Поділитися» вгорі, а не внизу, як на iPhone', () => {
		expect(GUIDES['ipad-safari'].steps[0].text).toBe('install.step.shareTop');
		expect(GUIDES['ios-safari'].steps[0].text).toBe('install.step.shareBottom');
	});
});
