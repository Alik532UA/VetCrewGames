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
	'account.signInTitle': 'Sign in',
	'account.why': 'An account is only needed for friends: to follow someone, they must recognise you the next day. You can play without one.',
	'account.signIn': 'Sign in',
	'account.register': 'Register',
	'account.signInHint': 'Careful: signing in to another account replaces the current player. Anything done anonymously stays with it.',
	'account.email': 'Email',
	'account.password': 'Password',
	'account.errorTaken': 'That email is already taken. Try “Sign in”.',
	'account.errorWeak': 'The password is too simple — at least six characters.',
	'account.errorEmail': 'That email is not written correctly.',
	'account.errorWrong': 'The email or password does not match.',
	'account.errorOther': 'It did not work. Try again.',
	'account.profileTitle': 'Profile',
	'account.handle': 'Handle',
	'account.handleHint': 'Lower-case Latin letters, digits and underscores; 3 to 20 characters. People find you by it.',
	'account.handleTaken': 'That handle is already taken.',
	'account.save': 'Save',
	'account.signOut': 'Sign out',
	'account.findTitle': 'Find people',
	'account.nobody': 'Nobody found.',
	'account.follow': 'Follow',
	'account.unfollow': 'Unfollow',
	'account.followingTitle': 'People I follow',
	'account.noFollowing': 'You do not follow anyone yet.',
	'account.mutual': 'mutual'
};
