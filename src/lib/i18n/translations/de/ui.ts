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
	'menu.reserve': 'Schutzgebiet',
	'menu.quiz': 'Quiz',

	// Die drei Einträge sind für das Quiz und für „Finde das Paar“ dieselben —
	// nur das Ziel von „Spielen“ unterscheidet sich.
	'menu.play': 'Spielen',
	'menu.playWithFriends': 'Mit Freunden spielen',
	'menu.playOnline': 'Online spielen',

	// Gemeinsame Runde von Finde ein Paar: Lobby, Rolle, Zug.
	'pairs.over': 'Die Runde ist zu Ende',
	'pairs.won': 'Gewonnen',
	'pairs.draw': 'Unentschieden',
	'pairs.rematch': 'Nochmal spielen',
	'pairs.closeRoom': 'Raum schließen',
	'pairs.actionFailed': 'Der Server hat diese Aktion abgelehnt.',
	'pairs.createRoom': 'Raum erstellen',
	'pairs.joinRoom': 'Mit Code beitreten',
	'pairs.roomCode': 'Raumcode',
	'pairs.yourName': 'Wie heißt du?',
	'pairs.rolePlayer': 'Spieler',
	'pairs.roleSpectator': 'Zuschauer',
	'pairs.start': 'Spiel starten',
	'pairs.needPlayers': 'Es braucht mindestens zwei Spieler.',
	'pairs.waitingHost': 'Warten, bis der Gastgeber startet.',
	'pairs.yourTurn': 'Du bist dran',
	'pairs.waitingFor': 'Am Zug',
	'pairs.noRoom': 'Diesen Raum gibt es nicht.',
	'pairs.oldVersion': 'Das Spiel wurde aktualisiert. Ladet die Seite neu — beide.',
	'pairs.rulesMissing': 'Gemeinsames Spielen ist auf dem Server noch nicht aktiviert.',
	'pairs.netFailed': 'Beitritt zum Raum fehlgeschlagen. Bitte erneut versuchen.',
	'pairs.opponentGone': 'Die Gegenseite spielt schon lange nicht.',
	'pairs.takeTurn': 'Zug übernehmen',
	'pairs.otherName': 'Anderer Name',
	'pairs.visibility': 'Wer darf beitreten',
	'pairs.friendsOnly': 'Nur Freunde',
	'pairs.everyone': 'Für alle',
	'pairs.visibilityHint': 'Nur Freunde — der Raum steht nicht in der Liste, hinein kommt man nur mit dem Code, den du weitergibst. Für alle — der Raum erscheint in jeder Liste.',
	'pairs.rooms': 'Räume',
	'pairs.noRooms': 'Noch keine offenen Räume',
	'pairs.noRoomsHint': 'Erstelle einen — er erscheint hier bei allen, die diese Seite offen haben.',
	'pairs.players': 'Spieler',
	'pairs.enter': 'Beitreten',
	'pairs.quickGame': 'Schnelles Spiel',
	'pairs.quickGameHint': 'Wir treten einem freien Raum bei oder erstellen einen neuen offenen.',
	'pairs.shownNewest': 'Neueste angezeigt — es gibt weitere',
	'pairs.startingIn': 'Start in',
	'pairs.seconds': 's',
	'pairs.roomsUnavailable': 'Die Raumliste ist nicht verfügbar. Beitreten per Code und Raum erstellen gehen weiter.',

	// Team-Namen: Adjektiv + Tier. GANZE Phrasen; starke Deklination ohne Artikel
	// (m -er, f -e, n -es) — siehe `config/crewNames.ts`.
	'pairs.crew1': 'Fröhliche Kuh',
	'pairs.crew2': 'Schlauer Fuchs',
	'pairs.crew3': 'Schläfriger Bär',
	'pairs.crew4': 'Höflicher Pinguin',
	'pairs.crew5': 'Weise Eule',
	'pairs.crew6': 'Stacheliger Igel',
	'pairs.crew7': 'Ruhiges Wasserschwein',
	'pairs.crew8': 'Fauler Panda',
	'pairs.crew9': 'Tapfere Ameise',
	'pairs.crew10': 'Stille Katze',
	'pairs.crew11': 'Lauter Papagei',
	'pairs.crew12': 'Netter Elefant',
	'pairs.crew13': 'Wachsamer Falke',
	'pairs.crew14': 'Geduldige Schildkröte',
	'pairs.crew15': 'Munterer Delfin',
	'pairs.crew16': 'Flauschiger Lemur',
	'pairs.crew17': 'Stolzer Löwe',
	'pairs.crew18': 'Schwatzhafte Krähe',
	'pairs.crew19': 'Springendes Känguru',
	'pairs.crew20': 'Glänzender Pfau',
	'pairs.crew21': 'Tapsiges Flusspferd',
	'pairs.crew22': 'Aufmerksamer Hirsch',
	'pairs.crew23': 'Lustiger Frosch',
	'pairs.crew24': 'Grimmiger Wolf',
	'menu.comingSoon': 'Noch in Arbeit',
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
	'memory.resized':
		'Die Bildschirmgröße hat sich geändert. Die Auslage blieb so, wie die Partie begann.',
	'memory.relayout': 'Neu austeilen',
	'memory.found': 'Gefunden',
	'memory.turn': 'Am Zug',
	'common.playAgain': 'Nochmal spielen',
	'common.next': 'Weiter',
	'common.back': 'Zurück',
	'common.mainMenu': 'Hauptmenü',
	'common.close': 'Schließen',
	'common.correct': 'Richtig!',
	'common.incorrect': 'Falsch!',
	'common.gameOver': 'Spiel vorbei!',
	'common.yourScore': 'Dein Ergebnis:',
	'common.maxScore': 'Maximum in dieser Runde',
	'common.paste': 'Einfügen',
	'common.copy': 'Kopieren',
	'common.clear': 'Löschen',
	'common.copied': 'Kopiert',
	'common.pasteDenied': 'Der Browser hat die Zwischenablage nicht freigegeben. Bitte von Hand einfügen: Strg+V.',
	'common.copyDenied': 'Der Browser hat das Schreiben in die Zwischenablage verweigert. Bitte von Hand kopieren: Strg+C.',

	// Beschriftungen der Symbolschaltflächen in der Kopfzeile: kein Text auf dem
	// Bildschirm, sondern das, was ein Screenreader vorliest — genau deshalb
	// gehören sie ins Wörterbuch (ACCESSIBILITY-v8 § 4.1). Verb zuerst, damit es
	// sich wie eine Handlung liest.
	'header.toggleTheme': 'Design wechseln',
	'header.toggleLocale': 'Sprache wechseln',
	'header.toggleFullscreen': 'Vollbild einschalten',
	'header.exitFullscreen': 'Vollbild beenden',
	'header.score': 'Gesamtpunktzahl',

	// Schalter für Einzeltasten-Kürzel (WCAG SC 2.1.4, Stufe A).
	'header.shortcutsOn': 'Tastenkürzel ausschalten',
	'header.shortcutsOff': 'Tastenkürzel einschalten',

	// Die Namen der Designs stehen als Text auf dem Bildschirm, nicht als
	// Vorlesetext: Sie sind die Einträge einer Liste. Benannt nach dem, was man
	// sieht — „orange-purple“ sagt niemandem etwas, „Herbst“ sagt alles.
	'theme.dark': 'Dunkel',
	'theme.light-green': 'Hellgrün',
	'theme.winter': 'Winter',
	'theme.orange-purple': 'Herbst',

	// Schaltfläche für den Protokollbericht, im Betrieb per Debug-Modus aktiv.
	'debug.copyLogs': 'Protokollbericht kopieren',

	// Fehler
	'error.title': 'Etwas ist schiefgelaufen',
	'error.message': 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.',
	'error.retry': 'Erneut versuchen',
	'error.goHome': 'Zur Startseite',
	// Beta-Checkliste. Die Punkte selbst liegen in `src/lib/config/beta/`.
	'beta.title': 'Beta-Test',
	'beta.intro':
		'Eine Liste von Dingen, die geprüft werden sollten. Markiere die Punkte, kopiere am Ende den Bericht und schicke ihn uns.',
	'beta.progress': 'In dieser Version markiert',
	'beta.vote.none': 'Nicht geprüft',
	'beta.vote.fail': 'Funktioniert nicht',
	'beta.vote.weird': 'Funktioniert, aber seltsam',
	'beta.vote.ok': 'Funktioniert',
	'beta.coverage.manual': 'Nur Menschen',
	'beta.coverage.testable': 'Noch kein automatischer Test',
	'beta.coverage.covered': 'Von einem Test abgedeckt',
	'beta.coverage.manualHint': 'Das prüft keine Maschine — hier brauchen wir deine Augen.',
	'beta.coverage.testableHint':
		'Das ließe sich automatisch prüfen, aber so eine Prüfung gibt es noch nicht.',
	'beta.coverage.coveredHint':
		'Hier schaut schon ein automatischer Test hin. Findest du hier einen Fehler, dann irrt der Test — und das ist besonders wertvoll.',
	'beta.stale': 'in einer anderen Version markiert',
	'beta.copy': 'Bericht kopieren',
	'beta.copied': 'Bericht kopiert',
	'beta.clear': 'Markierungen löschen',
	'beta.copyFailed':
		'Der Browser hat das Kopieren verweigert. Markiere den Text unten und kopiere ihn selbst.',
	'beta.rulesTitle': 'Zugriffsregeln der Datenbank',
	'beta.rulesCheck': 'Prüfen',
	'beta.rulesChecking': 'Frage die Datenbank…',
	'beta.rulesFresh': 'Die veröffentlichte Fassung passt zu diesem Build',
	'beta.rulesStale': 'In der Datenbank gilt eine ANDERE Fassung — dieser Build ist nicht veröffentlicht',
	'beta.rulesUnknown': 'Nicht feststellbar: kein Netz oder Datenbank nicht erreichbar',
	'pairs.startMode': 'Spielbeginn',
	'pairs.modeAuto': 'Autostart',
	'pairs.modeConfirm': 'Auf Bestätigung warten',
	'pairs.modeAutoHint': 'Das Spiel beginnt von selbst, sobald zwei Spieler da sind.',
	'pairs.modeConfirmHint': 'Das Spiel wartet, bis der Gastgeber „Spiel starten“ drückt.',
	'pairs.rulesStale': 'Der Server lässt nicht in den Raum. Meist sind die Datenbankregeln älter als dieser Build.',
} as const;
