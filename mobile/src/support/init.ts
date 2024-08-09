import { t } from '../support/intl';

globalThis.t = t;

if (typeof Symbol.asyncIterator === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  Symbol.asyncIterator = Symbol('asyncIterator');
}
