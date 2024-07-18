/* eslint-disable no-console */

const LogLevel = {
  DEBUG: 3,
  WARN: 2,
  ERROR: 1,
};

type Level = keyof typeof LogLevel;

type Options = {
  level?: Level;
};

export function createLogger(options: Options = {}) {
  const level = LogLevel[options.level ?? 'WARN'];
  return {
    log(...args: Array<unknown>) {
      if (level >= LogLevel.DEBUG) {
        console.log(...args);
      }
    },
    warn(...args: Array<unknown>) {
      if (level >= LogLevel.WARN) {
        console.warn(...args);
      }
    },
    error(...args: Array<unknown>) {
      if (level >= LogLevel.ERROR) {
        console.error(...args);
      }
    },
  };
}
