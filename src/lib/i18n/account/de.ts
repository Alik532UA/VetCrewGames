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
	'account.signInTitle': 'Anmelden',
	'account.why': 'Ein Konto braucht man nur für Freunde: um jemandem zu folgen, muss er Sie am nächsten Tag wiedererkennen. Spielen geht auch ohne.',
	'account.mode': 'Was tun',
	'account.modeRegister': 'Konto anlegen',
	'account.modeSignIn': 'In ein vorhandenes',
	'account.registerHint': 'Ihr aktuelles Profil und Ihre Räume BLEIBEN — das Konto wird an denselben Spieler gebunden.',
	'account.signInHint': 'Achtung: die Anmeldung in ein anderes Konto ersetzt den aktuellen Spieler. Anonym Erspieltes bleibt dort.',
	'account.email': 'E-Mail',
	'account.password': 'Passwort',
	'account.errorTaken': 'Diese E-Mail ist schon vergeben. Versuchen Sie „In ein vorhandenes“.',
	'account.errorWeak': 'Das Passwort ist zu einfach — mindestens sechs Zeichen.',
	'account.errorEmail': 'Die E-Mail ist nicht korrekt geschrieben.',
	'account.errorWrong': 'E-Mail oder Passwort stimmen nicht.',
	'account.errorOther': 'Es hat nicht funktioniert. Versuchen Sie es erneut.',
	'account.profileTitle': 'Profil',
	'account.handle': 'Kürzel',
	'account.handleHint': 'Kleine lateinische Buchstaben, Ziffern und Unterstriche; 3 bis 20 Zeichen. Danach findet man Sie.',
	'account.handleTaken': 'Dieses Kürzel ist schon vergeben.',
	'account.save': 'Speichern',
	'account.signOut': 'Abmelden',
	'account.findTitle': 'Leute finden',
	'account.nobody': 'Niemand gefunden.',
	'account.follow': 'Folgen',
	'account.unfollow': 'Nicht mehr folgen',
	'account.followingTitle': 'Wem ich folge',
	'account.noFollowing': 'Sie folgen noch niemandem.',
	'account.mutual': 'gegenseitig',
	'account.passwordShow': 'Passwort anzeigen',
	'account.passwordHide': 'Passwort verbergen',
	'account.capsLock': 'Caps Lock ist aktiv',
	'account.checkLayout': 'Tastaturbelegung prüfen — nicht lateinische Zeichen eingegeben',
	'account.forgotPassword': 'Passwort zurücksetzen',
	'account.resetTitle': 'Passwort zurücksetzen',
	'account.resetHint': 'Geben Sie die E-Mail des Kontos ein.',
	'account.resetSpam': 'Die Nachricht kann im Spam landen — die App ist neu.',
	'account.resetSend': 'E-Mail senden',
	'account.resetBack': 'Zurück zur Anmeldung',
	'account.resetSent': 'Falls diese E-Mail existiert, ist die Nachricht unterwegs.',
	'account.google': 'Mit Google anmelden',
	'account.or': 'oder',
	'account.errorGoogleOff': 'Google-Anmeldung ist noch nicht aktiviert. Bitte E-Mail verwenden.',
	// Regionsnamen und Texte der Länderauswahl. Warum hier und nicht im
	// Hauptwörterbuch — siehe Hinweis in `uk.ts` und `config/regions.ts`.
	'account.regionEurope': 'Europa',
	'account.regionAsia': 'Asien',
	'account.regionAfrica': 'Afrika',
	'account.regionNorthAmerica': 'Nordamerika',
	'account.regionSouthAmerica': 'Südamerika',
	'account.regionOceania': 'Ozeanien',
	'account.regionAntarctic': 'Antarktis',
	'account.countrySearch': 'Land suchen',
	'account.countryNotFound': 'Nichts gefunden',
};
