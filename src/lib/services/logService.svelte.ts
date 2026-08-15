import { browser, dev } from '$app/environment';
import { sessionStore } from '$lib/services/storage';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory = 'app' | 'ui' | 'network' | 'game_engine' | 'i18n';

// Будь-який JSON-серіалізовний контекст для логів. `unknown` — щоб явно narrow перед використанням.
export type LogContext = Record<string, unknown>;

interface LogConfig {
	app: boolean;
	ui: boolean;
	network: boolean;
	game_engine: boolean;
	i18n: boolean;
}

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	category: LogCategory;
	message: string;
	data?: unknown;
}

const config: LogConfig = {
	app: true,
	ui: true,
	network: true,
	game_engine: true,
	i18n: true
};

/**
 * Поля, які редагуються перед записом (DEBUGGING-v8 § 1.4, SECURITY-v8 § 10).
 *
 * Редакція живе в самому логері, а не на місцях виклику: достатньо одного
 * забутого місця, щоб правило не працювало. Тут це не теорія на майбутнє —
 * звіт із кнопки збору логів копіюють і надсилають ТРЕТІЙ ОСОБІ, а глобальна
 * сітка безпеки в layout пише в лог `event.reason` і `event.filename` цілком,
 * тобто те, що прийшло ззовні й чого ніхто не переглядав.
 */
const REDACT_KEY = /^(password|token|authorization|cookie|email|phone|secret|apikey|api_key)$/i;
const REDACTED = '«приховано»';

function scrub(value: unknown, depth = 0): unknown {
	// Обмеження глибини — не оптимізація: об'єкт із циклічним посиланням інакше
	// зациклює логер, а логер не має права зламати те, що логується (§ 1.5).
	if (depth > 6) return '«глибше не читаємо»';
	if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1));
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, nested]) => [
				key,
				REDACT_KEY.test(key) ? REDACTED : scrub(nested, depth + 1)
			])
		);
	}
	return value;
}

class LogService {
	private logs: LogEntry[] = [];
	private maxLogs = 1000;

	/**
	 * У дзеркало йде ХВІСТ буфера, а не всі 1000 записів (§ 1.5). Дзеркало
	 * потрібне рівно для того, щоб пережити перезавантаження сторінки, і
	 * складати туди всю історію означає щоразу серіалізувати мегабайт заради
	 * останніх кількох рядків — а потім упертися в квоту.
	 */
	private mirrorLimit = 100;
	public errorCount = $state(0);
	public appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown';

	constructor() {
		if (browser) {
			const savedLogs = sessionStore.get('logs');
			if (savedLogs) {
				try {
					this.logs = JSON.parse(savedLogs);
				} catch (e) {
					// Не викликаємо this.error() щоб уникнути рекурсії; логуємо напряму.
					console.warn('[logService] Failed to restore logs from sessionStorage', e);
				}
			}
		}
	}

	private persistLogs() {
		if (!browser) return;
		// Фасад сховища не кидає й повертає false при відмові — квота вичерпалася
		// або приватний режим. Втратити дзеркало прийнятно; втратити застосунок,
		// який щойно намагалися залогувати, — ні.
		sessionStore.set('logs', JSON.stringify(this.logs.slice(-this.mirrorLimit)));
	}

	private addLog(level: LogLevel, category: LogCategory, message: string, data?: unknown) {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			category,
			message,
			data: data === undefined ? undefined : scrub(data)
		};

		this.logs.push(entry);
		if (this.logs.length > this.maxLogs) {
			this.logs.shift();
		}

		if (level === 'error') {
			this.errorCount++;
		}

		this.persistLogs();

		if (!config[category]) return;

		const formattedMessage = `[${entry.timestamp}] [${level.toUpperCase()}] [${category.toUpperCase()}] ${message}`;

		if (level === 'error') {
			console.error(formattedMessage, data || '');
		} else if (dev) {
			if (level === 'warn') {
				console.warn(formattedMessage, data || '');
			} else {
				console.log(formattedMessage, data || '');
			}
		}
	}

	info(category: LogCategory, message: string, data?: LogContext) {
		this.addLog('info', category, message, data);
	}

	warn(category: LogCategory, message: string, data?: LogContext) {
		this.addLog('warn', category, message, data);
	}

	error(category: LogCategory, message: string, data?: unknown) {
		this.addLog('error', category, message, data);
	}

	getLogs() {
		return this.logs;
	}

	clear() {
		this.logs = [];
		this.errorCount = 0;
		this.persistLogs();
	}
}

export const logService = new LogService();
