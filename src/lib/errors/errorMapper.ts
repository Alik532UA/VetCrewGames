import { AppError, ValidationError, NotFoundError, NetworkError, AuthError } from './AppError';

export function errorToUserMessage(err: unknown): string {
	if (err instanceof ValidationError) return 'Перевірте введені дані';
	if (err instanceof NotFoundError) return err.message;
	if (err instanceof NetworkError) return 'Проблеми зі з\'єднанням';
	if (err instanceof AuthError) return 'Необхідна авторизація';
	if (err instanceof AppError) return err.message;
	return 'Сталася неочікувана помилка. Спробуйте пізніше.';
}
