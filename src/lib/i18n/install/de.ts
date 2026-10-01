/**
 * Das Fenster „Vollbild“ und die Installationsschritte der App — de.
 *
 * LAZY-Wörterbuch: Das Fenster öffnet sich erst auf Tippen, und das Root-Layout mit der
 * Taste ist am Budget. Die Schritte stammen aus Slovko (vom Autor geprüft), der Rest
 * wurde am 2026-09-29 ergänzt.
 */
export const install: Record<string, string> = {
	'install.title.choice': 'Vollbild',
	'install.browser': 'Vollbild in diesem Browser',
	'install.browserHint': 'Die Leisten des Browsers verschwinden. Dieselbe Taste holt sie zurück.',
	'install.app': 'App installieren',
	'install.appHint':
		'Dann öffnet sich das Spiel immer im Vollbild, weil es als eigene App startet.',
	'install.lead.blocked':
		'Dieses Gerät lässt das Spiel nicht im Vollbild laufen. Deshalb empfehlen wir, die App zu installieren: Dann öffnet sich das Spiel im Vollbild.',
	'install.done': 'Verstanden',

	'install.title.iphone': 'Auf iPhone installieren',
	'install.title.ipad': 'Auf iPad installieren',
	'install.title.app': 'App installieren',
	'install.title.already': 'App bereits installiert',
	'install.title.android': 'Auf Android installieren',
	'install.title.desktop': 'Auf Computer installieren',
	'install.title.mac': 'Auf Mac installieren',
	'install.title.inApp': 'Spiel im Browser öffnen',

	'install.alreadyInstalled.lead': 'VetCrewGames ist auf diesem Gerät bereits installiert.',
	'install.alreadyInstalled.hint':
		'Sie können sie vom Startbildschirm öffnen, um ohne Browserleisten zu spielen, oder hier im Vollbildmodus fortfahren.',

	'install.note.manual':
		'Die Sicherheitsregeln des Browsers erlauben keine Installation mit einem Tippen, daher sind ein paar Schritte selbst zu erledigen:',
	'install.note.firefox':
		'Firefox kann Websites höchstens unter Windows installieren, und nicht in jeder Version. Am einfachsten geht es mit Chrome oder Edge:',
	'install.note.inApp':
		'Der eingebaute Browser des Messengers kann keine Websites installieren. Öffnen Sie das Spiel zuerst in einem normalen Browser:',

	'install.step.shareBottom': 'Tippen Sie unten auf die Schaltfläche „Teilen“',
	'install.step.shareAddressBar':
		'Tippen Sie auf das Teilen-Symbol in der Adressleiste, rechts neben der Adresse',
	'install.step.shareMenu': 'Öffnen Sie das Browsermenü und tippen Sie auf „Teilen“',
	'install.step.shareTop': 'Tippen Sie oben rechts neben der Adressleiste auf „Teilen“',
	'install.step.addHome': 'Wählen Sie „Zum Home-Bildschirm“ im Menü',
	'install.step.addHomeChrome': 'Wählen Sie „Zum Home-Bildschirm“',
	'install.step.openHome':
		'Öffnen Sie das Spiel über das VetCrewGames-Symbol auf dem Home-Bildschirm – es startet im Vollbild',
	'install.step.dots': 'Tippen Sie auf die drei Punkte in der Browserecke',
	// Menünamen hier übersetzt, nicht am deutschen Chrome/Edge geprüft (uk und en sind geprüft).
	'install.step.addHomeAndroid':
		'Wählen Sie „Installieren und Verknüpfung erstellen“ (in älteren Chrome-Versionen: „Zum Startbildschirm hinzufügen“)',
	'install.step.edgeMenu':
		'Tippen Sie unten in der Mitte auf die Menütaste – drei waagerechte Striche',
	'install.step.edgeAddToPhone': 'Wählen Sie „Zum Telefon hinzufügen“',
	'install.step.openHomeAndroid':
		'Öffnen Sie das Spiel über das VetCrewGames-Symbol auf dem Startbildschirm – es startet im Vollbild',
	'install.step.installIcon':
		'Klicken Sie auf das Installationssymbol in der Adressleiste rechts neben der Adresse',
	'install.step.confirm': 'Bestätigen Sie „Installieren“',
	'install.step.openApp':
		'Öffnen Sie das Spiel über das App-Symbol – es startet in einem eigenen Fenster ohne Browserleisten',
	'install.step.macFile': 'Wählen Sie im Menü „Ablage“ den Punkt „Zum Dock hinzufügen“',
	'install.step.macAdd': 'Klicken Sie auf „Hinzufügen“',
	'install.step.openDock':
		'Öffnen Sie das Spiel über sein Symbol im Dock – es startet in einem eigenen Fenster',
	'install.step.openChromeEdge': 'Öffnen Sie das Spiel in Chrome oder Edge',
	'install.step.inAppMenu': 'Öffnen Sie das Menü des eingebauten Browsers (drei Punkte oben)',
	'install.step.inAppOpen': 'Wählen Sie „Im Browser öffnen“ – Safari oder Chrome',
	'install.step.inAppAgain': 'Tippen Sie dort noch einmal oben auf die Taste „Vollbild“',

	'install.warning.iosChrome':
		'Hinweis: Die Installation funktioniert nur über das Teilen-Symbol in der Adressleiste. Über das Drei-Punkte-Menü ist diese Funktion nicht verfügbar.'
};
