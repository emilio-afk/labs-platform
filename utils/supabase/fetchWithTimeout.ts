const DEFAULT_SUPABASE_TIMEOUT_MS = 8000;

const SUPABASE_TIMEOUT_MS = resolveTimeoutMs();

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // Respect an existing signal if the caller already manages cancellation.
  if (init?.signal) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, SUPABASE_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function resolveTimeoutMs(): number {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_TIMEOUT_MS;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_SUPABASE_TIMEOUT_MS;
}
