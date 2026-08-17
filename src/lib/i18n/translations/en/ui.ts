export const ui = {
	// App
	'app.title': 'Vet Crew Games',
	// Used for the meta description and link previews, so it has to read as a
	// standalone sentence rather than as UI copy.
	'app.description':
		'Free educational games about animals: test what you know about what they eat, how many are left, and the myths people still believe. Made in support of animal welfare.',

	// Main menu
	'menu.title': 'Vet Crew Games',
	'menu.game.feeding': 'What do they eat?',
	'menu.game.memory': 'Find a pair',
	'menu.game.random': 'Random game',
	'menu.reserve': 'Reserve',
	'menu.quiz': 'Quiz',

	// The three items are the same for the quiz and for "Find a pair" — only
	// where "Play" leads differs.
	'menu.play': 'Play',
	'menu.playWithFriends': 'Play with friends',
	'menu.playOnline': 'Play online',

	// Shared game of Find a Pair: lobby, role, turn.
	'pairs.over': 'The game is over',
	'pairs.createRoom': 'Create a room',
	'pairs.joinRoom': 'Join with a code',
	'pairs.roomCode': 'Room code',
	'pairs.yourName': 'Your name',
	'pairs.rolePlayer': 'Player',
	'pairs.roleSpectator': 'Spectator',
	'pairs.start': 'Start the game',
	'pairs.needPlayers': 'At least two players are needed.',
	'pairs.waitingHost': 'Waiting for the host to start.',
	'pairs.yourTurn': 'Your turn',
	'pairs.waitingFor': 'Turn',
	'pairs.noRoom': 'No such room.',
	'pairs.oldVersion': 'The game has been updated. Reload the page — both of you.',
	'pairs.rulesMissing': 'Shared play is not enabled on the server yet.',
	'pairs.netFailed': 'Could not join the room. Please try again.',
	'menu.comingSoon': 'Still in the works',
	'menu.game.population': 'Who is more?',
	'menu.game.habitat': 'Where do they live?',
	'menu.game.mythbusters': 'Fact or Myth?',
	'menu.game.family': 'Who is from another family?',
	'menu.link.vetcrew': 'Vet Crew',
	'menu.link.order': 'Order a game or website',

	// Common
	'common.skipLink': 'Skip to main content',
	'common.check': 'Check',
	// Підписи задано SCROLLBAR-v8 § 2.2.1, щоб два сайти на цьому пакеті
	// називали одне й те саме однаково.
	'scrollbar.title': 'Scrollbar',
	'scrollbar.standard': 'Standard',
	'scrollbar.custom': 'Author’s',
	'memory.title': 'Find a pair',
	'memory.card': 'Card',
	'memory.prompt': 'Flip two cards at a time. Matching ones stay face up.',
	'memory.you': 'You',
	'memory.rival': 'Rival',
	'memory.moves': 'Moves',
	'memory.resized': 'The screen size changed. The layout stayed as the party started.',
	'memory.relayout': 'Deal again to fit',
	'memory.found': 'Found',
	'memory.turn': 'Turn',
	'common.playAgain': 'Play again',
	'common.next': 'Next',
	'common.back': 'Back',
	'common.mainMenu': 'Main menu',
	'common.close': 'Close',
	'common.correct': 'Correct!',
	'common.incorrect': 'Incorrect!',
	'common.gameOver': 'Game Over!',
	'common.yourScore': 'Your Score:',

	// Icon-button labels in the header: not text on screen but what a screen
	// reader announces — which is exactly why they belong in the dictionary
	// (ACCESSIBILITY-v8 § 4.1). Verb first, so it reads as an action.
	'header.toggleTheme': 'Change theme',
	'header.toggleLocale': 'Change language',
	'header.toggleFullscreen': 'Enter fullscreen',
	'header.exitFullscreen': 'Exit fullscreen',
	'header.score': 'Total score',

	// Theme names are text on screen, not screen-reader labels: they are the
	// items of a list. Named by what you see rather than by the stored value —
	// "orange-purple" tells nobody anything, "Autumn" tells them everything.
	'theme.dark': 'Dark',
	'theme.light-green': 'Light green',
	'theme.winter': 'Winter',
	'theme.orange-purple': 'Autumn',

	// Log report button, enabled in production by debug mode.
	'debug.copyLogs': 'Copy log report',

	// Errors
	'error.title': 'Something went wrong',
	'error.message': 'An unexpected error occurred. Please try again.',
	'error.retry': 'Try again',
	'error.goHome': 'Go home'
} as const;
