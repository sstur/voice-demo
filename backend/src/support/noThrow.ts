type Result<T> = [data: T, error: undefined] | [data: undefined, error: Error];

export function noThrow<Args extends Array<unknown>, T>(
  fn: (...args: Args) => Promise<T>,
): (...args: Args) => Promise<Result<T>> {
  return async (...args) => {
    try {
      const data = await fn(...args);
      return [data, undefined];
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      return [undefined, error];
    }
  };
}
