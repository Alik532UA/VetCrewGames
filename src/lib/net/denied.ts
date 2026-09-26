/**
 * ЧИ ЦЕ ВІДМОВА ПРАВИЛ БАЗИ — одне розпізнавання на весь застосунок (аудит 2026-09-26).
 *
 * SDK Realtime Database кидає звичайний `Error` без коду — на відміну від Firestore
 * з `FirebaseError.code`, — тож відмова розпізнається за текстом: «PERMISSION_DENIED:
 * Permission denied». Доти ця регулярка стояла в семи місцях двома написаннями
 * (`permission_denied` і `permission[_ ]denied`), і кожна нова копія могла взяти не
 * те. Гейт по джерелах (`cloud-database.test.ts`) тримає її лише тут.
 */
export function isDenied(error: unknown): boolean {
	return /permission[_ ]denied/i.test(error instanceof Error ? error.message : String(error));
}
