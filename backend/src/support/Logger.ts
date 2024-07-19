/* eslint-disable no-console */

const LogLevel = {
  INFO: 3,
  WARN: 2,
  ERROR: 1,
};

type Level = keyof typeof LogLevel;

type Options = {
  level?: Level;
};

export class Logger {
  level: number;

  constructor(options: Options = {}) {
    this.level = LogLevel[options.level ?? 'WARN'];
  }

  log(...args: Array<unknown>) {
    if (this.level >= LogLevel.INFO) {
      console.log(...args);
    }
  }

  warn(...args: Array<unknown>) {
    if (this.level >= LogLevel.WARN) {
      console.warn(...args);
    }
  }

  error(...args: Array<unknown>) {
    if (this.level >= LogLevel.ERROR) {
      console.error(...args);
    }
  }
}

export function createLogger(options: Options = {}) {
  return new Logger(options);
}
