/**
 * Typed errors emitted by HttpClient.
 *
 * Using discriminated unions (the `kind` field) lets callers handle
 * each error type explicitly without instanceof checks.
 *
 * Usage:
 *   const result = await http.get(...);
 *   if (!result.ok) {
 *     switch (result.error.kind) {
 *       case 'unauthorized': await reauth(); break;
 *       case 'network':      showOfflineBanner(); break;
 *       ...
 *     }
 *   }
 */

export type HttpError =
  | NetworkError
  | TimeoutError
  | UnauthorizedError
  | ForbiddenError
  | NotFoundError
  | ServerError
  | UnknownHttpError;

interface BaseHttpError {
  message: string;
  cause?: unknown;
}

export interface NetworkError extends BaseHttpError {
  kind: 'network';
}

export interface TimeoutError extends BaseHttpError {
  kind: 'timeout';
  timeoutMs: number;
}

export interface UnauthorizedError extends BaseHttpError {
  kind: 'unauthorized';
  status: 401;
}

export interface ForbiddenError extends BaseHttpError {
  kind: 'forbidden';
  status: 403;
}

export interface NotFoundError extends BaseHttpError {
  kind: 'notFound';
  status: 404;
}

export interface ServerError extends BaseHttpError {
  kind: 'server';
  status: number; // 5xx
  body?: unknown;
}

export interface UnknownHttpError extends BaseHttpError {
  kind: 'unknown';
  status?: number;
  body?: unknown;
}

/** Helper: produces a human-readable error string for logs/UI. */
export function describeHttpError(error: HttpError): string {
  switch (error.kind) {
    case 'network':
      return `Network error: ${error.message}`;
    case 'timeout':
      return `Request timed out after ${error.timeoutMs}ms`;
    case 'unauthorized':
      return 'Unauthorized — please sign in again';
    case 'forbidden':
      return 'Forbidden — you do not have access to this resource';
    case 'notFound':
      return `Not found: ${error.message}`;
    case 'server':
      return `Server error (${error.status}): ${error.message}`;
    case 'unknown':
      return `HTTP error${error.status ? ` (${error.status})` : ''}: ${error.message}`;
  }
}