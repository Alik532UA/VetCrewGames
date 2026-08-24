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
	'account.signInTitle': 'Inloggen of registreren',
	'account.infoFriends':
		'Vrienden betekent elkaar volgen, dus beide kanten hebben een account nodig. Handle en avatar stel je na het inloggen in je profiel in.',
	'account.infoSignIn':
		'Inloggen op een bestaand account opent juist dat account — met zijn naam, zijn handle, zijn vrienden. De score en records uit deze browser komen erbij; onafgemaakte kamers van daarvoor verhuizen niet mee.',
	'account.infoRegister':
		'Registreren begint niets opnieuw. Je blijft dezelfde speler, wat je haalde blijft bij je — en wordt vanaf dan in het account bewaard, dus ook op je andere apparaten.',
	'account.infoWhy':
		'Zonder account werkt alles: spelen, kamers maken, punten halen. Maar de score en records leven dan alleen in deze browser — en verdwijnen met de gegevens ervan.',
	'account.infoOpen': 'Hoe het account werkt',
	'account.signIn': 'Inloggen',
	'account.register': 'Registreren',
	'account.email': 'E-mail',
	'account.password': 'Wachtwoord',
	'account.errorTaken': 'Dat e-mailadres is al in gebruik. Probeer “Inloggen”.',
	'account.errorWeak': 'Het wachtwoord is te simpel — minstens zes tekens.',
	'account.errorEmail': 'Dat e-mailadres is niet juist geschreven.',
	'account.errorWrong': 'E-mail of wachtwoord klopt niet.',
	'account.errorOther': 'Het lukte niet. Probeer opnieuw.',
	'account.profileTitle': 'Profiel',
	'account.gameName': 'Naam in het spel',
	'account.gameNameHint': 'Zo zien anderen je — in de kamer en op het scorebord.',
	'account.handle': '@naam om te zoeken',
	'account.handleHint':
		'Kleine Latijnse letters, cijfers en onderstrepingstekens; 3 tot 20 tekens. Hieraan vinden vrienden je — de naam in het spel is daarvoor niets, want die is niet uniek.',
	'account.handleTaken': 'Die gebruikersnaam is al bezet.',
	'account.errorNameEmpty': 'De naam is leeg — juist die zien anderen, dus zonder gaat het niet.',
	'account.errorHandleShape': 'De gebruikersnaam is te kort — minstens drie tekens.',
	'account.avatarColors': 'Kleur',
	'account.avatarIcons': 'Pictogram',
	'account.avatarColor.red': 'Rood',
	'account.avatarColor.orange': 'Oranje',
	'account.avatarColor.green': 'Groen',
	'account.avatarColor.teal': 'Turquoise',
	'account.avatarColor.blue': 'Blauw',
	'account.avatarColor.violet': 'Violet',
	'account.avatarColor.pink': 'Roze',
	'account.avatarColor.slate': 'Grijsblauw',
	'account.avatarIcon.user': 'Mens',
	'account.avatarIcon.cat': 'Kat',
	'account.avatarIcon.dog': 'Hond',
	'account.avatarIcon.rabbit': 'Konijn',
	'account.avatarIcon.bird': 'Vogel',
	'account.avatarIcon.fish': 'Vis',
	'account.avatarIcon.snail': 'Slak',
	'account.avatarIcon.turtle': 'Schildpad',
	'account.avatarIcon.bug': 'Kever',
	'account.avatarIcon.smile': 'Smiley',
	'account.avatarIcon.star': 'Ster',
	'account.avatarIcon.heart': 'Hart',
	'account.avatarIcon.zap': 'Bliksem',
	'account.avatarIcon.target': 'Doel',
	'account.save': 'Opslaan',
	'account.signOut': 'Uitloggen',
	'account.findTitle': 'Mensen zoeken',
	'account.nobody': 'Niemand gevonden.',
	'account.follow': 'Volgen',
	'account.unfollow': 'Ontvolgen',
	'account.followingTitle': 'Wie ik volg',
	'account.noFollowing': 'Je volgt nog niemand.',
	'account.mutual': 'wederzijds',
	'account.passwordShow': 'Wachtwoord tonen',
	'account.passwordHide': 'Wachtwoord verbergen',
	'account.capsLock': 'Caps Lock staat aan',
	'account.checkLayout': 'Controleer de toetsenbordindeling — niet-Latijnse tekens ingevoerd',
	'account.forgotPassword': 'Wachtwoord herstellen',
	'account.resetTitle': 'Wachtwoord herstellen',
	'account.resetHint': 'Voer het e-mailadres van het account in.',
	'account.resetSpam': 'Het bericht kan in Spam belanden — de app is nieuw.',
	'account.resetSend': 'E-mail versturen',
	'account.resetBack': 'Terug naar inloggen',
	'account.resetSent': 'Bestaat dat e-mailadres, dan is het bericht al verzonden.',
	'account.google': 'Doorgaan met Google',
	'account.or': 'of',
	'account.errorGoogleOff': 'Inloggen met Google is nog niet ingeschakeld. Gebruik e-mail.',
	// Regionamen en teksten van de landkeuze. Waarom hier en niet in het
	// hoofdwoordenboek — zie de toelichting in `uk.ts` en `config/regions.ts`.
	'account.regionEurope': 'Europa',
	'account.regionAsia': 'Azië',
	'account.regionAfrica': 'Afrika',
	'account.regionNorthAmerica': 'Noord-Amerika',
	'account.regionSouthAmerica': 'Zuid-Amerika',
	'account.regionOceania': 'Oceanië',
	'account.regionAntarctic': 'Antarctica',
	'account.countrySearch': 'Land zoeken',
	'account.countryNotFound': 'Niets gevonden',
	// Privacyschakelaars en het scorebord.
	'account.privacyTitle': 'Privacy',
	'account.privacyHint':
		'Deze schakelaars worden door de database zelf bewaakt: wat hier uit staat, ziet niemand — niet alleen op dit scherm.',
	'account.privacy.search': 'Toon mij in de zoekresultaten',
	'account.privacy.follow': 'Anderen mogen mij volgen',
	'account.privacy.board': 'Toon mij op het scorebord',
	'account.privacyOn': 'Aan',
	'account.privacyOff': 'Uit',
	'account.boardTitle': 'Scorebord',
	'account.boardAll': 'Iedereen',
	'account.boardFriends': 'Vrienden',
	'account.boardEmpty': 'Leeg: het bord begint bij {score} punten.',
	'account.boardNoFriends': 'Hier komen vrienden — wederzijdse volgers die al een score hebben.',
	'account.errorNotAllowed': 'Niet toegestaan — deze persoon heeft volgen misschien uitgezet.',
	// Wachtwoord en accountverwijdering.
	'account.securityTitle': 'Wachtwoord en verwijderen',
	'account.passwordCurrent': 'Huidig wachtwoord',
	'account.passwordNew': 'Nieuw wachtwoord',
	'account.passwordChange': 'Wachtwoord wijzigen',
	'account.passwordChanged': 'Wachtwoord gewijzigd.',
	'account.passwordGoogle': 'Je meldt je aan met Google — hier is geen apart wachtwoord.',
	'account.deleteTitle': 'Account verwijderen',
	'account.deleteHint':
		'Verwijderen kan niet ongedaan worden gemaakt: profiel, handle, volgers, score en records verdwijnen.',
	'account.deletePassword': 'Wachtwoord ter bevestiging',
	'account.deleteConfirm': 'Ja, verwijderen',
	'account.deleteCancel': 'Annuleren',
	'account.errorPasswordNeeded': 'Er is een wachtwoord nodig om te bevestigen.'
};
