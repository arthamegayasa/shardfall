// The only place in src/ that touches console (coding-standards 4.3). Debug lines vanish in production.

export interface Logger {
  debug(msg: string, ...rest: unknown[]): void;
  warn(msg: string, ...rest: unknown[]): void;
  error(msg: string, ...rest: unknown[]): void;
}

export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    debug(msg, ...rest) {
      if (__DEV_TOOLS__) console.debug(prefix, msg, ...rest);
    },
    warn(msg, ...rest) {
      console.warn(prefix, msg, ...rest);
    },
    error(msg, ...rest) {
      console.error(prefix, msg, ...rest);
    },
  };
}
