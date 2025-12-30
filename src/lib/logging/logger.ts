// ============================================
// TYPES
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  salonId?: string;
  userId?: string;
  customerId?: string;
  correlationId?: string;
  requestId?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    message: string;
    name: string;
    stack?: string;
  };
}

// ============================================
// SENSITIVE DATA MASKING
// ============================================

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'authorization', 'cookie', 'credit_card', 'cvv'];

function maskSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[MAX_DEPTH]';

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Mask email addresses partially
    if (obj.includes('@')) {
      const [local, domain] = obj.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    }
    // Mask phone numbers
    if (/^\+?\d{10,}$/.test(obj.replace(/\s/g, ''))) {
      return obj.substring(0, 4) + '****' + obj.substring(obj.length - 2);
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
        masked[key] = '[REDACTED]';
      } else {
        masked[key] = maskSensitiveData(value, depth + 1);
      }
    }
    return masked;
  }

  return obj;
}

// ============================================
// LOGGER IMPLEMENTATION
// ============================================

function formatLogEntry(entry: LogEntry): string {
  const maskedContext = entry.context ? maskSensitiveData(entry.context) : undefined;

  return JSON.stringify({
    ...entry,
    context: maskedContext,
  });
}

function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  return levels.indexOf(level) >= levels.indexOf(minLevel);
}

export const logger = {
  /**
   * Debug level logging - only in development
   */
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development' && shouldLog('debug')) {
      const entry: LogEntry = {
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        context,
      };
      console.debug(formatLogEntry(entry));
    }
  },

  /**
   * Info level logging - general operational messages
   */
  info(message: string, context?: LogContext) {
    if (shouldLog('info')) {
      const entry: LogEntry = {
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        context,
      };
      console.log(formatLogEntry(entry));
    }
  },

  /**
   * Warning level logging - potentially problematic situations
   */
  warn(message: string, context?: LogContext) {
    if (shouldLog('warn')) {
      const entry: LogEntry = {
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        context,
      };
      console.warn(formatLogEntry(entry));
    }
  },

  /**
   * Error level logging - error conditions
   */
  error(message: string, error?: Error, context?: LogContext) {
    if (shouldLog('error')) {
      const entry: LogEntry = {
        level: 'error',
        message,
        timestamp: new Date().toISOString(),
        context,
        error: error ? {
          message: error.message,
          name: error.name,
          stack: error.stack,
        } : undefined,
      };
      console.error(formatLogEntry(entry));
    }
  },

  /**
   * Log an API request
   */
  request(method: string, path: string, status: number, duration: number, context?: LogContext) {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const message = `${method} ${path} ${status} ${duration}ms`;

    if (level === 'error') {
      this.error(message, new Error(`HTTP ${status}`), { ...context, duration });
    } else if (level === 'warn') {
      this.warn(message, { ...context, duration });
    } else {
      this.info(message, { ...context, duration });
    }
  },

  /**
   * Log a business event (appointment, order, etc.)
   */
  event(eventName: string, context?: LogContext) {
    this.info(`EVENT: ${eventName}`, { ...context, action: eventName });
  },

  /**
   * Create a child logger with preset context
   */
  child(baseContext: LogContext) {
    return {
      debug: (message: string, context?: LogContext) =>
        logger.debug(message, { ...baseContext, ...context }),
      info: (message: string, context?: LogContext) =>
        logger.info(message, { ...baseContext, ...context }),
      warn: (message: string, context?: LogContext) =>
        logger.warn(message, { ...baseContext, ...context }),
      error: (message: string, error?: Error, context?: LogContext) =>
        logger.error(message, error, { ...baseContext, ...context }),
      event: (eventName: string, context?: LogContext) =>
        logger.event(eventName, { ...baseContext, ...context }),
    };
  },
};

// ============================================
// REQUEST ID / CORRELATION ID
// ============================================

let requestCounter = 0;

export function generateRequestId(): string {
  requestCounter = (requestCounter + 1) % 1000000;
  return `${Date.now().toString(36)}-${requestCounter.toString(36)}`;
}

// Legacy alias
export function generateCorrelationId(): string {
  return generateRequestId();
}

// ============================================
// PERFORMANCE TIMING HELPER
// ============================================

export function createTimer() {
  const start = performance.now();
  return {
    elapsed: () => Math.round(performance.now() - start),
  };
}
