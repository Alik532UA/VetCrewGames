/**
 * FNV-1a, 32 біти, по кодових одиницях рядка; результат беззнаковий.
 *
 * Один на весь застосунок (шостий аудит, Q4): доти дві однакові копії жили в
 * `utils/roomAvatars.ts` (заміна плитки за uid) і в колоді вікторини (потік колоди
 * кожної гри), і перша ж правка однієї тихо розвела б їх.
 */
export function fnv1a(text: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
	return hash >>> 0;
}
