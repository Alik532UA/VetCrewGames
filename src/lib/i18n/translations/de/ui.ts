export const ui = {
	// App
	'app.title': 'Vet Crew Games',
	// Steht in der Meta-Beschreibung und in Link-Vorschauen — muss also als
	// eigenständiger Satz lesbar sein, nicht als Bedienoberfläche.
	'app.description':
		'Kostenlose Lernspiele über Tiere: Prüfe, was du darüber weißt, was sie fressen, wie viele noch übrig sind und welche Mythen sich hartnäckig halten. Entstanden zur Unterstützung des Tierschutzes.',

	// Hauptmenü
	'menu.title': 'Vet Crew Games',
	'menu.game.feeding': 'Was fressen sie?',
	'menu.game.memory': 'Finde das Paar',
	'menu.game.random': 'Zufälliges Spiel',
	'menu.game.population': 'Wer ist häufiger?',
	'menu.game.habitat': 'Wo leben sie?',
	'menu.game.mythbusters': 'Fakt oder Mythos?',
	'menu.game.family': 'Wer gehört zu einer anderen Familie?',
	'menu.link.vetcrew': 'Vet Crew',
	'menu.link.order': 'Spiel oder Website bestellen',

	// Allgemein
	'common.skipLink': 'Zum Hauptinhalt springen',
	'common.check': 'Prüfen',
	// Die Bezeichnungen für Ukrainisch und Englisch gibt SCROLLBAR-v8 § 2.2.1
	// vor, damit zwei Websites auf demselben Paket dasselbe gleich nennen. Für
	// Deutsch und Niederländisch sagt der Kanon nichts — hier steht die
	// sinngemäße Entsprechung.
	'scrollbar.title': 'Bildlaufleiste',
	'scrollbar.standard': 'Standard',
	'scrollbar.custom': 'Eigene',
	'memory.title': 'Finde das Paar',
	'memory.card': 'Karte',
	'memory.prompt': 'Decke immer zwei Karten auf. Gleiche Paare bleiben offen liegen.',
	'memory.you': 'Du',
	'memory.rival': 'Gegner',
	'memory.moves': 'Züge',
	'memory.found': 'Gefunden',
	'memory.turn': 'Am Zug',
	'common.playAgain': 'Nochmal spielen',
	'common.next': 'Weiter',
	'common.back': 'Zurück',
	'common.mainMenu': 'Hauptmenü',
	'common.correct': 'Richtig!',
	'common.incorrect': 'Falsch!',
	'common.gameOver': 'Spiel vorbei!',
	'common.yourScore': 'Dein Ergebnis:',

	// Beschriftungen der Symbolschaltflächen in der Kopfzeile: kein Text auf dem
	// Bildschirm, sondern das, was ein Screenreader vorliest — genau deshalb
	// gehören sie ins Wörterbuch (ACCESSIBILITY-v8 § 4.1). Verb zuerst, damit es
	// sich wie eine Handlung liest.
	'header.toggleTheme': 'Design wechseln',
	'header.toggleLocale': 'Sprache wechseln',
	'header.toggleFullscreen': 'Vollbild einschalten',
	'header.exitFullscreen': 'Vollbild beenden',
	'header.score': 'Gesamtpunktzahl',

	// Schaltfläche für den Protokollbericht, im Betrieb per Debug-Modus aktiv.
	'debug.copyLogs': 'Protokollbericht kopieren',

	// Fehler
	'error.title': 'Etwas ist schiefgelaufen',
	'error.message': 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.',
	'error.retry': 'Erneut versuchen',
	'error.goHome': 'Zur Startseite'
} as const;
