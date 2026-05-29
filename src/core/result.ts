/**
 * Result type for explicit success/failure handling.
 *
 * Inspired by Rust's Result<T, E>. Encourages explicit error handling
 * over throw/catch, which TypeScript can't track in types.
 *
 * Usage:
 *   const result = await fetchStory(id);
 *   if (result.ok) {
 *     console.log(result.value.title);
 *   } else {
 *     console.error(result.error.message);
 *   }
 */

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** Creates a successful Result. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Creates a failed Result. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Wraps a Promise so it returns a Result instead of throwing. */
export async function tryAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    return err(error);
  }
}