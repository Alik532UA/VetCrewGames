/**
 * Сповіщення «вас чекають у грі» — nl.
 *
 * Словник ЛІНИВИЙ: кореневий layout стоїть рівно на бюджеті (120 КБ gzip зі стелі
 * 120), а це сповіщення бачить далеко не кожен відвідувач. Три рядки × чотири мови
 * в головному словнику коштували б бюджету, який уже витрачений.
 */
export const awaited: Record<string, string> = {
	'awaited.title': 'Je wordt in het spel verwacht',
	'awaited.return': 'Terugkeren',
	'awaited.leave': 'Kamer verlaten'
};
