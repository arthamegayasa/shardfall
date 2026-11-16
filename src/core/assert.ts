// Boundary assertions (load, commands). Never in hot loops (coding-standards 7).

export class AssertionError extends Error {
  override readonly name = 'AssertionError';
}

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new AssertionError(msg);
}

/** Exhaustiveness helper for switch statements over unions. */
export function unreachable(value: never, msg = 'Unreachable'): never {
  throw new AssertionError(`${msg}: ${String(value)}`);
}
