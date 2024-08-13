export function once<A extends Array<unknown>>(
  fn: (...args: A) => void,
): (...args: A) => void {
  let called = false;

  return (...args: A) => {
    if (!called) {
      called = true;
      fn(...args);
    }
  };
}
