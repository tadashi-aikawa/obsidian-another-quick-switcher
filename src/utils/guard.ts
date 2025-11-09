/**
 * Return null when arg is null or undefined; otherwise, return the result of callable(arg).
 */
export function map<T, U>(
  arg: T | null | undefined,
  callable: (arg: T) => U,
): U | null {
  return arg != null ? callable(arg) : null;
}

/**
 * Throw an exception when arg is null or undefined; otherwise, return the result of callable(arg).
 */
export function orThrow<T, U = void>(
  arg: T | null | undefined,
  callable: (arg: T) => U,
  opts?: { message?: string },
): U {
  if (arg != null) {
    return callable(arg);
  }
  throw Error(
    opts?.message ??
      "Processing was aborted because an unexpected undefined or null value occurred.",
  );
}
