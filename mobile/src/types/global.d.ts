/* eslint-disable no-var */
import type { TFn } from '../support/intl';

declare global {
  // NOTE: Need to use `var` and not `const` here for weird TS reasons.
  // Source https://stackoverflow.com/a/69429093
  var t: TFn;
}
