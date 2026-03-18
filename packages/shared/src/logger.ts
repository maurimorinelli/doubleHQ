// ─── Log Levels ────────────────────────────────────────
export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

const LOG_PRIORITY: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
};

/** Resolve threshold from LOG_LEVEL env var (works in Node and Vite) */
function getThreshold(): number {
    let raw = 'DEBUG';
    // Node.js / API — access process safely without requiring @types/node
    try {
        const proc = (globalThis as Record<string, unknown>).process as
            { env?: Record<string, string | undefined> } | undefined;
        if (proc?.env?.LOG_LEVEL) {
            raw = proc.env.LOG_LEVEL;
        }
    } catch { /* browser — no process */ }
    return LOG_PRIORITY[raw.toUpperCase() as LogLevel] ?? LOG_PRIORITY[LogLevel.DEBUG];
}

// ─── Provider Interface ────────────────────────────────
// Implement this interface to swap in Sentry, Datadog, Pino, etc.
export interface LoggerProvider {
    log(level: LogLevel, message: string, meta: Record<string, unknown>): void;
}

// ─── Console Provider (default) ────────────────────────
export class ConsoleLoggerProvider implements LoggerProvider {
    log(level: LogLevel, message: string, meta: Record<string, unknown>): void {
        const timestamp = new Date().toISOString();
        const context = Object.keys(meta).length > 0 ? meta : undefined;

        const prefix = `[${timestamp}] [${level}]`;

        switch (level) {
            case LogLevel.DEBUG:
                // eslint-disable-next-line no-console
                console.debug(prefix, message, ...(context ? [context] : []));
                break;
            case LogLevel.INFO:
                // eslint-disable-next-line no-console
                console.log(prefix, message, ...(context ? [context] : []));
                break;
            case LogLevel.WARN:
                // eslint-disable-next-line no-console
                console.warn(prefix, message, ...(context ? [context] : []));
                break;
            case LogLevel.ERROR:
                // eslint-disable-next-line no-console
                console.error(prefix, message, ...(context ? [context] : []));
                break;
        }
    }
}

// ─── Logger Class ──────────────────────────────────────
export class Logger {
    private readonly threshold: number;

    constructor(
        private readonly name: string,
        private readonly provider: LoggerProvider,
    ) {
        this.threshold = getThreshold();
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_PRIORITY[level] >= this.threshold;
    }

    debug(message: string, context?: Record<string, unknown>): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;
        this.provider.log(LogLevel.DEBUG, message, { logger: this.name, ...context });
    }

    info(message: string, context?: Record<string, unknown>): void {
        if (!this.shouldLog(LogLevel.INFO)) return;
        this.provider.log(LogLevel.INFO, message, { logger: this.name, ...context });
    }

    warn(message: string, context?: Record<string, unknown>): void {
        if (!this.shouldLog(LogLevel.WARN)) return;
        this.provider.log(LogLevel.WARN, message, { logger: this.name, ...context });
    }

    error(message: string, error?: unknown, context?: Record<string, unknown>): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;
        const errorMeta: Record<string, unknown> = { logger: this.name, ...context };

        if (error instanceof Error) {
            errorMeta.errorName = error.name;
            errorMeta.errorMessage = error.message;
            errorMeta.stack = error.stack;
        } else if (error !== undefined) {
            errorMeta.errorRaw = String(error);
        }

        this.provider.log(LogLevel.ERROR, message, errorMeta);
    }
}

// ─── Factory ───────────────────────────────────────────
// To swap providers: createLogger('API', new SentryLoggerProvider())
const defaultProvider = new ConsoleLoggerProvider();

export function createLogger(name: string, provider?: LoggerProvider): Logger {
    return new Logger(name, provider ?? defaultProvider);
}
