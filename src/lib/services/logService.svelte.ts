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

class LogService {
	private logs: LogEntry[] = [];
	private maxLogs = 1000;
	public errorCount = $state(0);
	public appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown';

	constructor() {
		if (browser) {
			const savedLogs = sessionStore.get('logs');
			if (savedLogs) {
				try {
					this.logs = JSON.parse(savedLogs);
				} catch (e) {
					// Ignore
				}
			}
		}
	}

	private persistLogs() {
		if (browser) {
			sessionStore.set('logs', JSON.stringify(this.logs));
		}
	}

	private addLog(level: LogLevel, category: LogCategory, message: string, data?: unknown) {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			category,
			message,
			data
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
