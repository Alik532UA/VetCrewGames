export const ui = {
	// App
	'app.title': 'Vet Crew Games',
	// Staat in de meta-omschrijving en in linkvoorbeelden — moet dus als losse
	// zin te lezen zijn, niet als knoptekst.
	'app.description':
		'Gratis educatieve spellen over dieren: test wat je weet over wat ze eten, hoeveel er nog over zijn en welke mythen mensen nog altijd geloven. Gemaakt ter ondersteuning van dierenwelzijn.',

	// Hoofdmenu
	'menu.title': 'Vet Crew Games',
	'menu.game.feeding': 'Wat eten ze?',
	'menu.game.memory': 'Zoek het paar',
	'menu.game.random': 'Willekeurig spel',
	'menu.game.population': 'Wie komt vaker voor?',
	'menu.game.habitat': 'Waar wonen ze?',
	'menu.game.mythbusters': 'Feit of mythe?',
	'menu.game.family': 'Wie hoort bij een andere familie?',
	'menu.link.vetcrew': 'Vet Crew',
	'menu.link.order': 'Een spel of website bestellen',

	// Algemeen
	'common.skipLink': 'Naar de hoofdinhoud',
	'common.check': 'Controleren',
	// De Oekraïense en Engelse benamingen liggen vast in SCROLLBAR-v8 § 2.2.1,
	// zodat twee sites op hetzelfde pakket hetzelfde hetzelfde noemen. Voor
	// Duits en Nederlands zegt de canon niets — hier staat het equivalent.
	'scrollbar.title': 'Schuifbalk',
	'scrollbar.standard': 'Standaard',
	'scrollbar.custom': 'Eigen',
	'memory.title': 'Zoek het paar',
	'memory.card': 'Kaart',
	'memory.prompt': 'Draai er telkens twee om. Gelijke paren blijven open liggen.',
	'memory.you': 'Jij',
	'memory.rival': 'Tegenstander',
	'memory.moves': 'Zetten',
	'memory.found': 'Gevonden',
	'memory.turn': 'Aan zet',
	'common.playAgain': 'Opnieuw spelen',
	'common.next': 'Verder',
	'common.back': 'Terug',
	'common.mainMenu': 'Hoofdmenu',
	'common.correct': 'Goed!',
	'common.incorrect': 'Fout!',
	'common.gameOver': 'Spel voorbij!',
	'common.yourScore': 'Jouw score:',

	// Bijschriften van de pictogramknoppen in de kopbalk: geen tekst op het
	// scherm, maar wat een schermlezer voorleest — precies daarom horen ze in het
	// woordenboek (ACCESSIBILITY-v8 § 4.1). Werkwoord voorop, zodat het als een
	// handeling klinkt.
	'header.toggleTheme': 'Thema wisselen',
	'header.toggleLocale': 'Taal wisselen',
	'header.toggleFullscreen': 'Volledig scherm aan',
	'header.exitFullscreen': 'Volledig scherm uit',
	'header.score': 'Totaalscore',

	// Knop voor het lograpport, in productie aan via de debugmodus.
	'debug.copyLogs': 'Lograpport kopiëren',

	// Fouten
	'error.title': 'Er is iets misgegaan',
	'error.message': 'Er is een onverwachte fout opgetreden. Probeer het opnieuw.',
	'error.retry': 'Opnieuw proberen',
	'error.goHome': 'Naar de startpagina'
} as const;
