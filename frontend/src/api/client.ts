const API = import.meta.env.VITE_API_URL || ""

class ApiError extends Error {
  status: number
  constructor(msg: string, status: number) { super(msg); this.status = status }
}

async function handle<T>(r: Response): Promise<T> {
  if (r.status === 401) {
    // Only throw — let AuthContext and ProtectedRoute handle the redirect
    // Full page reload via window.location would destroy React state (including post-login user)
    throw new ApiError("Sessao expirada", 401)
  }
  if (!r.ok) {
    let msg = ""
    try {
      const data = await r.json()
      msg = data.detail || data.message || JSON.stringify(data)
    } catch {
      msg = await r.text().catch(() => `HTTP ${r.status}`)
    }
    throw new ApiError(msg, r.status)
  }
  return r.json()
}

export async function apiGet<T>(url: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : ""
  return handle<T>(await fetch(`${API}${url}${qs}`, { credentials: "include" }))
}

export async function apiPost<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  return handle<T>(await fetch(`${API}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  }))
}
