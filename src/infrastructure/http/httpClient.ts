import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { Logger } from '../../core/logger';
import { Result, err, ok } from '../../core/result';
import { HttpError } from './httpErrors';

/**
 * Provides the auth token at request time.
 *
 * Returns a Promise so the client can fetch tokens from secure storage
 * without callers needing to plumb tokens manually for every request.
 */
export type TokenProvider = () => Promise<string | undefined>;

export interface HttpClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  tokenProvider?: TokenProvider;
  logger: Logger;
  /** Optional name (e.g., "Copado API") for log clarity. */
  name?: string;
}

export interface RequestOptions {
  /** Query parameters appended to the URL. */
  query?: Record<string, string | number | boolean | undefined>;
  /** Additional headers (merged with defaults). */
  headers?: Record<string, string>;
  /** Per-request timeout override. */
  timeoutMs?: number;
  /** If false, suppress the Authorization header (e.g., for sign-in itself). */
  authenticate?: boolean;
}

/**
 * A thin, opinionated HTTP client.
 *
 * - Returns Result<T, HttpError> instead of throwing
 * - Logs every request/response (debug level) and error (warn/error level)
 * - Auto-attaches Bearer token from the TokenProvider
 * - Normalizes HTTP errors into typed HttpError variants
 *
 * One instance per "API" (e.g., one for Copado Core, one for CRT, one for AI Hub).
 */
export class HttpClient {
  private readonly axios: AxiosInstance;
  private readonly logger: Logger;
  private readonly tokenProvider?: TokenProvider;
  private readonly name: string;

  constructor(options: HttpClientOptions) {
    this.logger = options.logger;
    this.tokenProvider = options.tokenProvider;
    this.name = options.name ?? 'HTTP';

    this.axios = axios.create({
      baseURL: options.baseUrl,
      timeout: options.timeoutMs ?? 30_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  // ─── Public verb helpers ─────────────────────────────────────────────

  get<T>(path: string, options?: RequestOptions): Promise<Result<T, HttpError>> {
    return this.request<T>({ method: 'GET', url: path, ...options });
  }

  post<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<Result<T, HttpError>> {
    return this.request<T>({ method: 'POST', url: path, data: body, ...options });
  }

  put<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<Result<T, HttpError>> {
    return this.request<T>({ method: 'PUT', url: path, data: body, ...options });
  }

  patch<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<Result<T, HttpError>> {
    return this.request<T>({ method: 'PATCH', url: path, data: body, ...options });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<Result<T, HttpError>> {
    return this.request<T>({ method: 'DELETE', url: path, ...options });
  }

  // ─── Core request method ─────────────────────────────────────────────

  private async request<T>(
    config: AxiosRequestConfig & RequestOptions
  ): Promise<Result<T, HttpError>> {
    // Build final headers (with optional auth)
    const headers: Record<string, string> = { ...(config.headers ?? {}) };

    if (config.authenticate !== false && this.tokenProvider) {
      const token = await this.tokenProvider();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    // Build final axios config
    const axiosConfig: AxiosRequestConfig = {
      method: config.method,
      url: config.url,
      data: config.data,
      params: config.query,
      headers,
      timeout: config.timeoutMs,
    };

    const startedAt = Date.now();
    this.logger.debug(`[${this.name}] → ${config.method} ${config.url}`, {
      query: config.query,
      hasBody: config.data !== undefined,
    });

    try {
      const response: AxiosResponse<T> = await this.axios.request<T>(axiosConfig);
      const elapsed = Date.now() - startedAt;
      this.logger.debug(
        `[${this.name}] ← ${response.status} ${config.method} ${config.url} (${elapsed}ms)`
      );
      return ok(response.data);
    } catch (e) {
      const elapsed = Date.now() - startedAt;
      const httpError = this.normalizeError(e, config.timeoutMs);
      this.logger.warn(
        `[${this.name}] ✖ ${config.method} ${config.url} (${elapsed}ms): ${httpError.message}`,
        { kind: httpError.kind }
      );
      return err(httpError);
    }
  }

  /**
   * Converts an axios error into our typed HttpError union.
   * Handles all the discriminated cases: network, timeout, status codes.
   */
  private normalizeError(error: unknown, timeoutMs?: number): HttpError {
    // Not an axios error at all
    if (!axios.isAxiosError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      return { kind: 'unknown', message, cause: error };
    }

    const axiosError = error as AxiosError;

    // Timeout
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return {
        kind: 'timeout',
        message: 'Request timed out',
        timeoutMs: timeoutMs ?? this.axios.defaults.timeout ?? 30_000,
        cause: axiosError,
      };
    }

    // Network error (no response received)
    if (!axiosError.response) {
      return {
        kind: 'network',
        message: axiosError.message || 'Network error',
        cause: axiosError,
      };
    }

    const status = axiosError.response.status;
    const body = axiosError.response.data;
    const baseMessage = this.extractMessage(body) ?? axiosError.message;

    if (status === 401) {
      return { kind: 'unauthorized', status: 401, message: baseMessage };
    }
    if (status === 403) {
      return { kind: 'forbidden', status: 403, message: baseMessage };
    }
    if (status === 404) {
      return { kind: 'notFound', status: 404, message: baseMessage };
    }
    if (status >= 500) {
      return { kind: 'server', status, message: baseMessage, body };
    }

    return { kind: 'unknown', status, message: baseMessage, body };
  }

  /** Best-effort extraction of an error message from a response body. */
  private extractMessage(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const candidate = body as Record<string, unknown>;
    if (typeof candidate.message === 'string') return candidate.message;
    if (typeof candidate.error === 'string') return candidate.error;
    if (
      candidate.error &&
      typeof candidate.error === 'object' &&
      typeof (candidate.error as Record<string, unknown>).message === 'string'
    ) {
      return (candidate.error as Record<string, string>).message;
    }
    return undefined;
  }
}