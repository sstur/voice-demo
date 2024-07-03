/* eslint-disable no-var, @typescript-eslint/consistent-type-definitions */
import '@total-typescript/ts-reset';

import type { TFn } from '../support/intl';

declare global {
  // NOTE: Need to use `var` and not `const` here for weird TS reasons.
  // Source https://stackoverflow.com/a/69429093
  var t: TFn;

  // Override some built-in types to be more helpful.
  interface ObjectConstructor {
    new (value?: unknown): object & Record<PropertyKey, unknown>;
    (value?: unknown): object & Record<PropertyKey, unknown>;

    keys<T>(
      o: T,
    ): T extends Record<string, unknown>
      ? Array<keyof T & string>
      : Array<string>;

    entries<T>(
      o: T,
    ): T extends Record<string, infer U>
      ? Array<[keyof T & string, U]>
      : T extends ArrayLike<infer U>
        ? Array<[string, U]>
        : Array<[string, unknown]>;
  }

  // ===
  // The rest of these are some helpful global utility types
  // ===

  type ValueOf<T extends object> = T[keyof T];

  // This is used to "expand" an intersection of two or more objects when
  // displayed in tooltips, for example `Expand<{ a: string } & { b: string }>`
  // will expand to `{ a: string, b: string }`
  // Reference: https://stackoverflow.com/a/57683652
  type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

  type TimeoutId = ReturnType<typeof setTimeout>;
}
