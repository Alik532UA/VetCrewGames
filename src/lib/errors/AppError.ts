export class AppError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly cause?: unknown
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class ValidationError extends AppError {
	constructor(public readonly fields: Record<string, string>) {
		super('VALIDATION_ERROR', 'Дані некоректні');
	}
}

export class NotFoundError extends AppError {
	constructor(resource: string) {
		super('NOT_FOUND', `${resource} не знайдено`);
	}
}

export class NetworkError extends AppError {
	constructor(
		message: string,
		public readonly status?: number
	) {
		super('NETWORK_ERROR', message);
	}
}

export class AuthError extends AppError {
	constructor(message = 'Необхідна авторизація') {
		super('AUTH_ERROR', message);
	}
}
