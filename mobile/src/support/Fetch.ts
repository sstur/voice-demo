import { useLocalStorage } from '../providers/LocalStorageProvider';
import { AUTH_TOKEN_KEY } from './constants';

/**
 * This is used with checkResponseType to produce helpful type hints
 */
type ContentType = 'application/json' | 'application/x-www-form-urlencoded';

type ReqInit = Expand<
  Omit<RequestInit, 'method' | 'body'> & {
    method?: 'GET' | 'PUT' | 'POST' | 'DELETE';
    // Previously this was ReadableStream | Blob | BufferSource | FormData | URLSearchParams | string
    body?: unknown;
  }
>;

export function useApiFetch() {
  const localStorage = useLocalStorage();
  return async (url: string, init: ReqInit = {}) => {
    const apiBaseUrl = localStorage.getItem('API_BASE_URL') ?? '';
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const normalizedUrl = normalizeApiUrl(url, apiBaseUrl);
    const headers = addAuthHeaders(init.headers, authToken);
    return await fetch(toRequest(normalizedUrl, { ...init, headers }));
  };
}

/**
 * This ensures the URL points to our API
 */
function normalizeApiUrl(url: string, apiBaseUrl: string) {
  const parsed = new URL(url, apiBaseUrl);
  const reconstructed = parsed.pathname + parsed.search;
  return new URL(reconstructed, apiBaseUrl);
}

export function addAuthHeaders(
  headers: HeadersInit | undefined,
  authToken: string | null,
) {
  if (authToken !== null) {
    const newHeaders = new Headers(headers);
    newHeaders.set('X-Auth-Token', authToken);
    return newHeaders;
  }
  return headers;
}

function toRequest(url: string | URL, init: ReqInit): Request {
  const headers = new Headers(init.headers);
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  if (body !== undefined && headers.get('content-type') == null) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  return new Request(url, { ...init, method, headers, body });
}

function parseContentType(contentTypeHeader: string | null) {
  return (contentTypeHeader ?? '').toLowerCase().split(';')[0] ?? '';
}

/**
 * This will throw an UnexpectedStatusError if response status is not 2xx.
 * Will accept a second arg fo additional allowed status codes. For example, in
 * the case of an auth endpoint, we might expect either 200 or 401. In this case
 * we can pass the 401 as an additional allowed status as follows:
 *     checkResponseStatus(response, [401])
 */
export function checkResponseStatus(
  response: Response,
  additionalAllowed?: Array<number>,
) {
  if (response.ok) {
    return;
  }
  const { status } = response;
  if (additionalAllowed?.includes(status)) {
    return;
  }
  throw new UnexpectedStatusError(status);
}

/**
 * Will throw an UnexpectedContentTypeError if response content type does not
 * match expected type.
 */
export function checkResponseType(
  response: Response,
  expectedType: ContentType,
) {
  const contentType = parseContentType(response.headers.get('content-type'));
  if (contentType !== expectedType) {
    throw new UnexpectedContentTypeError(
      t('Unexpected response type from server: {contentType}', { contentType }),
    );
  }
}

export class FetchError extends Error {
  get name() {
    return this.constructor.name;
  }

  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
}

export class UnexpectedStatusError extends FetchError {
  readonly status: number;

  constructor(status: number, options?: ErrorOptions) {
    const message = t('Unexpected response status from server: {status}', {
      status,
    });
    super(message, options);
    this.status = status;
  }
}

export class UnexpectedContentTypeError extends FetchError {
  readonly contentType: string;

  constructor(contentType: string, options?: ErrorOptions) {
    const message = t('Unexpected response type from server: {contentType}', {
      contentType,
    });
    super(message, options);
    this.contentType = contentType;
  }
}
