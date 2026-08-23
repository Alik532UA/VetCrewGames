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
	'pairs.won': 'Winner',
	'pairs.draw': 'A draw',
	'pairs.rematch': 'Play again',
	'pairs.closeRoom': 'Close the room',
	'pairs.actionFailed': 'The server refused this action.',
	'pairs.createRoom': 'Create a room',
	'pairs.joinRoom': 'Join with a code',
	'pairs.roomCode': 'Room code',
	'pairs.yourName': 'What\'s your name?',
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
	'pairs.opponentGone': 'Your opponent has been idle for a while.',
	'pairs.takeTurn': 'Take the turn',
	'pairs.otherName': 'Another name',
	'pairs.privateRoom': 'Private room',
	'pairs.privateRoomHint': 'A private room is not in the list — it can only be joined with its code.',
	'pairs.rooms': 'Rooms',
	'pairs.noRooms': 'No open rooms yet',
	'pairs.noRoomsHint': 'Create one — it will show up here for everyone who has this page open.',
	'pairs.players': 'Players',
	'pairs.enter': 'Enter',
	'pairs.quickGame': 'Quick game',
	'pairs.quickGameHint': 'We will join a free room, or create a new open one if there is none.',
	'pairs.shown': 'Showing',
	'pairs.startingIn': 'Starting in',
	'pairs.seconds': 's',
	'pairs.cancelStart': 'Not yet',
	'pairs.roomsUnavailable': 'The room list is unavailable. Joining by code and creating a room still work.',

	// Crew names for the shared game. WHOLE phrases — see `config/crewNames.ts`.
	'pairs.crew1': 'Head Vet',
	'pairs.crew2': 'Kind Nurse',
	'pairs.crew3': 'Young Vet',
	'pairs.crew4': 'Brave Keeper',
	'pairs.crew5': 'Night Watch',
	'pairs.crew6': 'Sharp Orderly',
	'pairs.crew7': 'Patient Surgeon',
	'pairs.crew8': 'Cheerful Nanny',
	'pairs.crew9': 'Senior Zoologist',
	'pairs.crew10': 'Careful Pharmacist',
	'pairs.crew11': 'Quiet Helper',
	'pairs.crew12': 'Wise Mentor',
	'pairs.crew13': 'Caring Groomer',
	'pairs.crew14': 'Keen Researcher',
	'pairs.crew15': 'Gentle Handler',
	'pairs.crew16': 'Nimble Intern',
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
	'common.maxScore': 'Best possible in this game',
	'common.paste': 'Paste',
	'common.copy': 'Copy',
	'common.clear': 'Clear',
	'common.copied': 'Copied',
	'common.pasteDenied': 'The browser would not read the clipboard. Paste by hand: Ctrl+V.',
	'common.copyDenied': 'The browser would not write to the clipboard. Copy by hand: Ctrl+C.',

	// Icon-button labels in the header: not text on screen but what a screen
	// reader announces — which is exactly why they belong in the dictionary
	// (ACCESSIBILITY-v8 § 4.1). Verb first, so it reads as an action.
	'header.toggleTheme': 'Change theme',
	'header.toggleLocale': 'Change language',
	'header.toggleFullscreen': 'Enter fullscreen',
	'header.exitFullscreen': 'Exit fullscreen',
	'header.score': 'Total score',

	// Switch for single-character shortcuts (WCAG SC 2.1.4, level A). The label
	// names the ACTION the press performs, not the current state: the state comes
	// from `aria-pressed`, and repeating it in the label would tell the user the
	// opposite of what is about to happen.
	'header.shortcutsOn': 'Turn keyboard shortcuts off',
	'header.shortcutsOff': 'Turn keyboard shortcuts on',

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
	'error.goHome': 'Go home',
	// Beta checklist page. The items themselves live in `src/lib/config/beta/`.
	'beta.title': 'Beta testing',
	'beta.intro':
		'A list of things worth checking. Mark the items, then copy the report at the end and send it to us.',
	'beta.progress': 'Marked on this version',
	'beta.vote.none': 'Not checked',
	'beta.vote.fail': 'Broken',
	'beta.vote.weird': 'Works, but odd',
	'beta.vote.ok': 'Works',
	'beta.coverage.manual': 'People only',
	'beta.coverage.testable': 'No automated test yet',
	'beta.coverage.covered': 'Covered by a test',
	'beta.coverage.manualHint': 'No machine checks this — your own eyes are what is needed here.',
	'beta.coverage.testableHint': 'This could be checked automatically, but no such test exists yet.',
	'beta.coverage.coveredHint':
		'An automated test already watches this. If you find a bug here, the test is wrong — and that is especially valuable to us.',
	'beta.stale': 'marked on a different version',
	'beta.copy': 'Copy the report',
	'beta.copied': 'Report copied',
	'beta.clear': 'Clear the marks',
	'beta.copyFailed': 'The browser refused to copy it. Select the text below and copy it by hand.'
} as const;
