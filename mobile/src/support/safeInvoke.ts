type Result<T> =
  | { ok: true; result: T; error?: undefined }
  | { ok: false; error: unknown; result?: undefined };

export async function safeInvoke<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const result = await fn();
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error };
  }
}
