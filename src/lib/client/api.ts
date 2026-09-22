"use client";

export class ApiFailure extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  url: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const hasBody = options?.body !== undefined;
  const res = await fetch(url, {
    method: options?.method ?? "GET",
    headers: hasBody ? { "Content-Type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(options!.body) : undefined,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiFailure(
      (data as { error?: string }).error ?? "Something went wrong.",
      res.status,
      data as Record<string, unknown>,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body }),
};
