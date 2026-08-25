export { languageEntries as entries } from '$lib/i18n/entries';
// Словник заповідника тягне `load`, а не `onMount`: інакше сирі ключі лишаються
// в пререндері назавжди. Причина й заміри — в `$lib/i18n/reserve/route.ts`.
export { load } from '$lib/i18n/reserve/route';
