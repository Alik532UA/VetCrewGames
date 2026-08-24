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
	'account.signInTitle': 'Inloggen',
	'account.why': 'Een account is alleen nodig voor vrienden: om iemand te volgen moet die je morgen herkennen. Spelen kan ook zonder.',
	'account.signIn': 'Inloggen',
	'account.register': 'Registreren',
	'account.signInHint': 'Let op: inloggen op een ander account vervangt de huidige speler. Wat anoniem gedaan is, blijft daar.',
	'account.email': 'E-mail',
	'account.password': 'Wachtwoord',
	'account.errorTaken': 'Dat e-mailadres is al in gebruik. Probeer “Inloggen”.',
	'account.errorWeak': 'Het wachtwoord is te simpel — minstens zes tekens.',
	'account.errorEmail': 'Dat e-mailadres is niet juist geschreven.',
	'account.errorWrong': 'E-mail of wachtwoord klopt niet.',
	'account.errorOther': 'Het lukte niet. Probeer opnieuw.',
	'account.profileTitle': 'Profiel',
	'account.handle': 'Gebruikersnaam',
	'account.handleHint': 'Kleine Latijnse letters, cijfers en liggende streepjes; 3 tot 20 tekens. Zo vinden ze je.',
	'account.handleTaken': 'Die gebruikersnaam is al bezet.',
	'account.save': 'Opslaan',
	'account.signOut': 'Uitloggen',
	'account.findTitle': 'Mensen zoeken',
	'account.nobody': 'Niemand gevonden.',
	'account.follow': 'Volgen',
	'account.unfollow': 'Ontvolgen',
	'account.followingTitle': 'Wie ik volg',
	'account.noFollowing': 'Je volgt nog niemand.',
	'account.mutual': 'wederzijds'
};
