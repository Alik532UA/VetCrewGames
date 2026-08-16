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
	'memory.prompt': 'Flip two cards at a time. Matching ones stay face up.',
	'memory.you': 'You',
	'memory.rival': 'Rival',
	'memory.moves': 'Moves',
	'memory.found': 'Found',
	'memory.turn': 'Turn',
	'common.playAgain': 'Play again',
	'common.next': 'Next',
	'common.back': 'Back',
	'common.mainMenu': 'Main menu',
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

	// Log report button, enabled in production by debug mode.
	'debug.copyLogs': 'Copy log report',

	// Errors
	'error.title': 'Something went wrong',
	'error.message': 'An unexpected error occurred. Please try again.',
	'error.retry': 'Try again',
	'error.goHome': 'Go home'
} as const;
