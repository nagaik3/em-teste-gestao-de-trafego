const API = import.meta.env.VITE_API_URL || ""

class ApiError extends Error {
  status: number
  constructor(msg: string, status: number) { super(msg); this.status = status }
}

async function handle<T>(r: Response): Promise<T> {
  if (!r.ok) {
    if (r.status === 401 && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login"
    }
    throw new ApiError(await r.text().catch(() => ""), r.status)
  }
  return r.json()
}

export async function apiGet<T>(url: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : ""
  return handle<T>(await fetch(`${API}${url}${qs}`, { credentials: "include" }))
}

export async function apiPost<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  return handle<T>(await fetch(`${API}${url}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }))
}
