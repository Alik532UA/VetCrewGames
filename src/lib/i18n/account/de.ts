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
	'account.signInTitle': 'Anmelden oder registrieren',
	'account.infoFriends':
		'Freunde heißt: einander folgen, also braucht es auf beiden Seiten ein Konto. Kürzel und Avatar werden nach der Anmeldung im Profil gesetzt.',
	'account.infoSignIn':
		'Die Anmeldung in einem vorhandenen Konto öffnet genau dieses Konto — mit seinem Namen, seinem Kürzel, seinen Freunden. Punktestand und Rekorde aus diesem Browser kommen hinzu; unbeendete Räume von vorher ziehen nicht mit um.',
	'account.infoRegister':
		'Die Registrierung fängt nicht von neuem an. Du bleibst derselbe Spieler, das Erspielte bleibt bei dir — und wird von da an im Konto bewahrt, also auch auf deinen anderen Geräten.',
	'account.infoWhy':
		'Ohne Konto funktioniert alles: spielen, Räume erstellen, Punkte sammeln. Punktestand und Rekorde leben dann aber nur in diesem Browser — und verschwinden mit seinen Daten.',
	'account.infoOpen': 'Wie das Konto funktioniert',
	'account.signIn': 'Anmelden',
	'account.register': 'Registrieren',
	'account.email': 'E-Mail',
	'account.password': 'Passwort',
	'account.errorTaken': 'Diese E-Mail ist schon vergeben. Versuchen Sie „Anmelden“.',
	'account.errorWeak': 'Das Passwort ist zu einfach — mindestens sechs Zeichen.',
	'account.errorEmail': 'Die E-Mail ist nicht korrekt geschrieben.',
	'account.errorWrong': 'E-Mail oder Passwort stimmen nicht.',
	'account.errorOther': 'Es hat nicht funktioniert. Versuchen Sie es erneut.',
	'account.avatarTitle': 'Avatar',
	'account.avatarHint': 'Wird sofort gespeichert, sobald du wählst.',
	'account.avatarFailed': 'Avatar konnte nicht gespeichert werden. Bitte nochmal versuchen.',
	'account.profileTitle': 'Profil',
	'account.gameName': 'Name im Spiel',
	'account.gameNameHint': 'So sehen dich die anderen — im Raum und in der Rangliste.',
	'account.handle': '@Kürzel für die Suche',
	'account.handleHint':
		'Kleine lateinische Buchstaben, Ziffern und Unterstriche; 3 bis 20 Zeichen. Genau daran finden dich Freunde — der Name im Spiel taugt dafür nicht, weil er nicht eindeutig ist.',
	'account.handleTaken': 'Dieses Kürzel ist schon vergeben.',
	'account.errorNameEmpty':
		'Der Name fehlt — genau ihn sehen die anderen, also geht es ohne ihn nicht.',
	'account.errorHandleShape': 'Das Kürzel ist zu kurz — mindestens drei Zeichen.',
	'account.avatarColors': 'Farbe',
	'account.avatarIcons': 'Symbol',
	'account.avatarColor.red': 'Rot',
	'account.avatarColor.orange': 'Orange',
	'account.avatarColor.green': 'Grün',
	'account.avatarColor.teal': 'Türkis',
	'account.avatarColor.blue': 'Blau',
	'account.avatarColor.violet': 'Violett',
	'account.avatarColor.pink': 'Rosa',
	'account.avatarColor.slate': 'Schiefergrau',
	'account.avatarIcon.user': 'Mensch',
	'account.avatarIcon.cat': 'Katze',
	'account.avatarIcon.dog': 'Hund',
	'account.avatarIcon.rabbit': 'Hase',
	'account.avatarIcon.bird': 'Vogel',
	'account.avatarIcon.fish': 'Fisch',
	'account.avatarIcon.snail': 'Schnecke',
	'account.avatarIcon.turtle': 'Schildkröte',
	'account.avatarIcon.bug': 'Käfer',
	'account.avatarIcon.smile': 'Smiley',
	'account.avatarIcon.star': 'Stern',
	'account.avatarIcon.heart': 'Herz',
	'account.avatarIcon.zap': 'Blitz',
	'account.avatarIcon.target': 'Ziel',
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
	'account.google': 'Weiter mit Google',
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
	// Datenschutz-Schalter und die Rangliste.
	'account.privacyTitle': 'Privatsphäre',
	'account.privacyHint':
		'Diese Schalter hält die Datenbank selbst: Was hier aus ist, sieht niemand — nicht nur auf diesem Bildschirm.',
	'account.privacy.search': 'Mich in der Suche zeigen',
	'account.privacy.follow': 'Anderen erlauben, mir zu folgen',
	'account.privacy.board': 'Mich in der Rangliste zeigen',
	'account.privacyOn': 'Ein',
	'account.privacyOff': 'Aus',
	'account.boardTitle': 'Rangliste',
	'account.boardAll': 'Alle',
	'account.boardFriends': 'Freunde',
	'account.boardEmpty': 'Leer: die Rangliste beginnt bei {score} Punkten.',
	'account.boardNoFriends':
		'Hier erscheinen Freunde — gegenseitige Abos, die schon einen Punktestand haben.',
	'account.errorNotAllowed': 'Nicht erlaubt — diese Person hat Abos vielleicht geschlossen.',
	// Passwort und Kontolöschung.
	'account.securityTitle': 'Passwort und Löschen',
	'account.passwordCurrent': 'Aktuelles Passwort',
	'account.passwordNew': 'Neues Passwort',
	'account.passwordChange': 'Passwort ändern',
	'account.passwordChanged': 'Passwort geändert.',
	'account.passwordGoogle': 'Du meldest dich mit Google an — hier gibt es kein eigenes Passwort.',
	'account.deleteTitle': 'Konto löschen',
	'account.deleteHint':
		'Das Löschen ist endgültig: Profil, Kürzel, Abos, Punktestand und Rekorde verschwinden.',
	'account.deletePassword': 'Passwort zur Bestätigung',
	'account.deleteConfirm': 'Ja, löschen',
	'account.deleteCancel': 'Abbrechen',
	'account.errorPasswordNeeded': 'Zum Bestätigen ist ein Passwort nötig.'
};
