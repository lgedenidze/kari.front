// Browser-side API client. Calls this site's own /api/*, which app/api/[...path] passes on.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    /** Machine-readable code from the API, e.g. "quota_reached". The dictionary owns the wording. */
    public readonly code: string,
    /** Per-field codes on a 400, e.g. { phone: "phone_invalid" }. */
    public readonly fields: Record<string, string> = {},
  ) {
    super(code);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "network");
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // An empty or non-JSON body: fall through with null.
  }

  if (!response.ok) {
    const error = payload as { error?: string; fields?: Record<string, string> } | null;
    throw new ApiError(response.status, error?.error ?? (response.status >= 500 ? "server_error" : "validation"), error?.fields ?? {});
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown = {}) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown = {}) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
