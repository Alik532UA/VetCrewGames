/**
 * The «Full screen» window and the app install steps — en.
 *
 * LAZY dictionary: the window opens on a press, and the root layout that holds the button
 * is at its budget. The steps come from Slovko (checked by the author), the rest was
 * written 2026-09-29.
 */
export const install: Record<string, string> = {
	'install.title.choice': 'Full screen',
	'install.browser': 'Full screen in this browser',
	'install.browserHint': 'The browser’s bars will hide. The same button brings them back.',
	'install.app': 'Install the app',
	'install.appHint':
		'Then the game will always open full screen, because it will start as a separate app.',
	'install.lead.blocked':
		'This device does not let the game go full screen. So we suggest installing the app: then the game will open full screen.',
	'install.done': 'Got it',

	'install.title.iphone': 'Install on iPhone',
	'install.title.ipad': 'Install on iPad',
	'install.title.app': 'Install the app',
	'install.title.android': 'Install on Android',
	'install.title.desktop': 'Install on a computer',
	'install.title.mac': 'Install on Mac',
	'install.title.inApp': 'Open the game in a browser',

	'install.note.manual':
		'The browser’s security does not allow installing the app in one tap, so a few steps have to be done by hand:',
	'install.note.firefox':
		'Firefox can install sites only on Windows, and not in every version. The easiest way is Chrome or Edge:',
	'install.note.inApp':
		'The messenger’s built-in browser cannot install sites. First open the game in a regular browser:',

	'install.step.shareBottom': 'Tap the “Share” button at the bottom of the screen',
	'install.step.shareAddressBar':
		'Tap the “Share” icon in the address bar, to the right of the address',
	'install.step.shareMenu': 'Open the browser menu and tap “Share”',
	'install.step.shareTop': 'Tap the “Share” button at the top, to the right of the address bar',
	'install.step.addHome': 'Choose “Add to Home Screen” in the menu',
	'install.step.addHomeChrome': 'Choose “Add to Home Screen”',
	'install.step.openHome':
		'Open the game with the VetCrewGames icon on the Home Screen — it will start full screen',
	'install.step.dots': 'Tap the three dots in the corner of the browser',
	// The label as in Chrome 149–150; the old one in brackets: Chrome rolls the rename out
	// gradually, so some phones still show it.
	'install.step.addHomeAndroid':
		'Choose “Install and create shortcut” (in older Chrome versions, “Add to Home screen”)',
	'install.step.edgeMenu': 'Tap the menu button at the bottom centre — three horizontal lines',
	'install.step.edgeAddToPhone': 'Choose “Add to phone”',
	'install.step.openHomeAndroid':
		'Open the game with the VetCrewGames icon on the home screen — it will start full screen',
	'install.step.installIcon':
		'Click the install icon in the address bar, to the right of the address',
	'install.step.confirm': 'Confirm “Install”',
	'install.step.openApp':
		'Open the game with the app icon — it will start in its own window without the browser’s bars',
	'install.step.macFile': 'In the “File” menu choose “Add to Dock”',
	'install.step.macAdd': 'Click “Add”',
	'install.step.openDock':
		'Open the game with its icon in the Dock — it will start in its own window',
	'install.step.openChromeEdge': 'Open the game in Chrome or Edge',
	'install.step.inAppMenu': 'Open the menu of the built-in browser (three dots at the top)',
	'install.step.inAppOpen': 'Choose “Open in browser” — Safari or Chrome',
	'install.step.inAppAgain': 'There, press the “Full screen” button in the header once more',

	'install.warning.iosChrome':
		'Note: installing works only through the “Share” icon in the address bar. It is not available through the “three dots” menu.'
};
