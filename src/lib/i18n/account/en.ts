/**
 * Рядки сторінки акаунта — ОКРЕМИЙ словник, а не частина `ui`.
 *
 * Причина заміряна, і вона та сама, що в `i18n/crew`: усі чотири мови
 * імпортуються в кореневий layout, тобто потрапляють у перший payload КОЖНОГО
 * відвідувача. Двадцять вісім рядків на мову додали до нього 2 КБ gzip і
 * перевищили бюджет layout (122 проти 120) — заради сторінки, яку відкриє
 * далеко не кожен.
 *
 * Тепер словник довантажується динамічно — див. `i18n/account/index.ts`.
 * Паритет мов стереже `src/i18n-account.test.ts`, бо `check:i18n` звіряє
 * зібрані словники й цих ключів більше не бачить.
 */
export const account: Record<string, string> = {
	'account.signInTitle': 'Sign in or register',
	'account.infoFriends':
		'Friends means following each other, so both sides need an account. The handle and avatar are set after signing in, in the profile.',
	'account.infoSignIn':
		'Signing into an existing account opens that account — its name, its handle, its friends. The score and records from this browser are added to it; unfinished rooms started before the sign-in do not move into the account.',
	'account.infoRegister':
		'Registering does not start over. You stay the same player, what you scored stays with you — and from then on it is kept in the account, so it opens on your other devices.',
	'account.infoWhy':
		'Everything works without an account: playing, creating rooms, scoring. But then the score and records live only in this browser — and go away with its data.',
	'account.infoOpen': 'How the account works',
	'account.signIn': 'Sign in',
	'account.register': 'Register',
	'account.email': 'Email',
	'account.password': 'Password',
	'account.errorTaken': 'That email is already taken. Try “Sign in”.',
	'account.errorWeak': 'The password is too simple — at least six characters.',
	'account.errorEmail': 'That email is not written correctly.',
	'account.errorWrong': 'The email or password does not match.',
	'account.errorOther': 'It did not work. Try again.',
	'account.profileTitle': 'Profile',
	'account.gameName': 'Name in game',
	'account.gameNameHint': 'This is how others see you — in the room and on the leaderboard.',
	'account.handle': '@handle for search',
	'account.handleHint':
		'Lower-case Latin letters, digits and underscores; 3 to 20 characters. This is what friends find you by — the in-game name will not do, because it is not unique.',
	'account.handleTaken': 'That handle is already taken.',
	'account.errorNameEmpty': 'The name is empty — it is what others see, so it cannot be left out.',
	'account.errorHandleShape': 'The handle is too short — at least three characters.',
	'account.avatarColors': 'Colour',
	'account.avatarIcons': 'Icon',
	'account.avatarColor.red': 'Red',
	'account.avatarColor.orange': 'Orange',
	'account.avatarColor.green': 'Green',
	'account.avatarColor.teal': 'Teal',
	'account.avatarColor.blue': 'Blue',
	'account.avatarColor.violet': 'Violet',
	'account.avatarColor.pink': 'Pink',
	'account.avatarColor.slate': 'Slate',
	'account.avatarIcon.user': 'Person',
	'account.avatarIcon.cat': 'Cat',
	'account.avatarIcon.dog': 'Dog',
	'account.avatarIcon.rabbit': 'Rabbit',
	'account.avatarIcon.bird': 'Bird',
	'account.avatarIcon.fish': 'Fish',
	'account.avatarIcon.snail': 'Snail',
	'account.avatarIcon.turtle': 'Turtle',
	'account.avatarIcon.bug': 'Bug',
	'account.avatarIcon.smile': 'Smiley',
	'account.avatarIcon.star': 'Star',
	'account.avatarIcon.heart': 'Heart',
	'account.avatarIcon.zap': 'Lightning',
	'account.avatarIcon.target': 'Target',
	'account.save': 'Save',
	'account.signOut': 'Sign out',
	'account.findTitle': 'Find people',
	'account.nobody': 'Nobody found.',
	'account.follow': 'Follow',
	'account.unfollow': 'Unfollow',
	'account.followingTitle': 'People I follow',
	'account.noFollowing': 'You do not follow anyone yet.',
	'account.mutual': 'mutual',
	'account.passwordShow': 'Show password',
	'account.passwordHide': 'Hide password',
	'account.capsLock': 'Caps Lock is on',
	'account.checkLayout': 'Check your keyboard layout — non-Latin characters entered',
	'account.forgotPassword': 'Reset password',
	'account.resetTitle': 'Password reset',
	'account.resetHint': 'Enter the email the account is registered to.',
	'account.resetSpam': 'The message may land in Spam — the app is new.',
	'account.resetSend': 'Send the email',
	'account.resetBack': 'Back to sign in',
	'account.resetSent': 'If that email exists, the message is already on its way.',
	'account.google': 'Continue with Google',
	'account.or': 'or',
	'account.errorGoogleOff': 'Google sign-in is not enabled yet. Use email instead.',
	// Region names and the country-picker strings. Why they live here and not in
	// the main dictionary — see the note in `uk.ts` and `config/regions.ts`.
	'account.regionEurope': 'Europe',
	'account.regionAsia': 'Asia',
	'account.regionAfrica': 'Africa',
	'account.regionNorthAmerica': 'North America',
	'account.regionSouthAmerica': 'South America',
	'account.regionOceania': 'Oceania',
	'account.regionAntarctic': 'Antarctica',
	'account.countrySearch': 'Search country',
	'account.countryNotFound': 'Nothing found',
	// Privacy switches and the leaderboard.
	'account.privacyTitle': 'Privacy',
	'account.privacyHint':
		'These switches are held by the database itself: what is off here is hidden from everyone, not just on this screen.',
	'account.privacy.search': 'Show me in search',
	'account.privacy.follow': 'Let others follow me',
	'account.privacy.board': 'Show me on the leaderboard',
	'account.privacyOn': 'On',
	'account.privacyOff': 'Off',
	'account.boardTitle': 'Leaderboard',
	'account.boardAll': 'Everyone',
	'account.boardFriends': 'Friends',
	'account.boardEmpty': 'Empty: the board starts at {score} points.',
	'account.boardNoFriends': 'Friends will appear here — mutual follows that already have a score.',
	'account.errorNotAllowed': 'Not allowed — this person may have closed follows.',
	// Password and account deletion.
	'account.securityTitle': 'Password and deletion',
	'account.passwordCurrent': 'Current password',
	'account.passwordNew': 'New password',
	'account.passwordChange': 'Change password',
	'account.passwordChanged': 'Password changed.',
	'account.passwordGoogle': 'You sign in with Google — there is no separate password here.',
	'account.deleteTitle': 'Delete account',
	'account.deleteHint':
		'Deletion cannot be undone: the profile, handle, follows, score and records all go.',
	'account.deletePassword': 'Password to confirm',
	'account.deleteConfirm': 'Yes, delete',
	'account.deleteCancel': 'Cancel',
	'account.errorPasswordNeeded': 'A password is needed to confirm.'
};
