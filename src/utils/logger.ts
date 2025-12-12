import { CONFIG } from '../config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[CONFIG.LOG_LEVEL as LogLevel] || LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= currentLevel;
}

function formatMessage(level: LogLevel, message: string, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  const emoji = {
    debug: '🔍',
    info: 'ℹ️ ',
    warn: '⚠️ ',
    error: '❌',
  }[level];
  
  return `[${timestamp}] ${emoji} [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  debug(message: string, ...args: any[]) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message), ...args);
    }
  },

  info(message: string, ...args: any[]) {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message), ...args);
    }
  },

  warn(message: string, ...args: any[]) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message), ...args);
    }
  },

  error(message: string, ...args: any[]) {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message), ...args);
    }
  },
};