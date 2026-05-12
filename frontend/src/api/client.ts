const API = import.meta.env.VITE_API_URL || ""

class ApiError extends Error {
  status: number
  constructor(msg: string, status: number) { super(msg); this.status = status }
}

// Access token stored in memory only (not localStorage, not sessionStorage)
let _accessToken: string | null = null

export function setAccessToken(token: string | null) { _accessToken = token }
export function getAccessToken() { return _accessToken }

async function handle<T>(r: Response): Promise<T> {
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

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" }
  if (_accessToken) h["Authorization"] = `Bearer ${_accessToken}`
  return h
}

async function refreshToken(): Promise<boolean> {
  try {
    const r = await fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" })
    if (!r.ok) return false
    const data = await r.json()
    _accessToken = data.access_token
    return true
  } catch { return false }
}

async function fetchWithRetry(url: string, opts: RequestInit): Promise<Response> {
  let r = await fetch(url, opts)
  if (r.status === 401 && _accessToken) {
    // Token expired — try refresh
    const ok = await refreshToken()
    if (ok) {
      // Retry with new token
      const newOpts = { ...opts, headers: { ...authHeaders() } }
      r = await fetch(url, newOpts)
    }
  }
  return r
}

export async function apiGet<T>(url: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : ""
  return handle<T>(await fetchWithRetry(`${API}${url}${qs}`, {
    headers: authHeaders(),
    credentials: "include",
  }))
}

export async function apiPost<T>(url: string, body?: Record<string, unknown>): Promise<T> {
  return handle<T>(await fetchWithRetry(`${API}${url}`, {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  }))
}

// Special: login doesn't use auth headers, and captures the access token
export async function apiLogin(email: string, password: string): Promise<any> {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",  // Important: receive refresh_token cookie
    body: JSON.stringify({ email, password }),
  })
  if (!r.ok) {
    let msg = "Credenciais invalidas"
    try { const d = await r.json(); msg = d.detail || msg } catch {}
    throw new ApiError(msg, r.status)
  }
  const data = await r.json()
  _accessToken = data.access_token
  return data
}

// Special: logout clears token
export async function apiLogout(): Promise<void> {
  try {
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
    })
  } catch {}
  _accessToken = null
}
