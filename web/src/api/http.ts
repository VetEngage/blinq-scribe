import { authHeader } from "./session";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Called when the server says the session is gone (401), unless the call was made signed out on purpose. */
let signedOutHandler: () => void = () => {};
export const onSignedOut = (fn: () => void): void => {
  signedOutHandler = fn;
};
export const signedOut = (): void => signedOutHandler();

interface RequestOptions {
  method?: string;
  body?: unknown;
  anonymous?: boolean;
  signal?: AbortSignal;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const isForm = opts.body instanceof FormData;
  const headers: Record<string, string> = { ...authHeader() };
  if (opts.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  const res = await fetch(path, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers,
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    signal: opts.signal,
  });
  const body: unknown = await res.json().catch(() => ({}));
  if (res.status === 401 && !opts.anonymous) signedOutHandler();
  if (!res.ok) {
    const detail = (body as { detail?: unknown }).detail;
    throw new ApiError(typeof detail === "string" ? detail : res.statusText || "Request failed", res.status);
  }
  return body as T;
}

/**
 * Files load with the Authorization header like every other call, then show from a local blob URL,
 * so no credential ever goes in a URL. The caller revokes the URL when it is done with it.
 */
export async function blobUrl(path: string): Promise<string> {
  const res = await fetch(path, { headers: authHeader() });
  if (res.status === 401) signedOutHandler();
  if (!res.ok) throw new ApiError(res.status === 404 ? "Not available yet" : res.statusText, res.status);
  return URL.createObjectURL(await res.blob());
}

export const q = (v: string | number | null | undefined): string => encodeURIComponent(v ?? "");
