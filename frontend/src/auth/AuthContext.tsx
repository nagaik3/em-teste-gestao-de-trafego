import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { apiGet, apiLogin, apiLogout, setAccessToken } from "../api/client"

interface User { email: string; nome: string; role: string; gestor_key: string | null }
interface Ctx { user: User | null; isLoading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => Promise<void> }

const AuthContext = createContext<Ctx | null>(null)

function loadCachedUser(): User | null {
  try { const s = sessionStorage.getItem("impera_user"); return s ? JSON.parse(s) : null } catch { return null }
}

function saveCachedUser(u: User | null) {
  if (u) sessionStorage.setItem("impera_user", JSON.stringify(u))
  else sessionStorage.removeItem("impera_user")
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadCachedUser)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // On mount: try to refresh the access token using the refresh_token cookie
    // This handles page reloads — the refresh cookie persists, access token doesn't
    fetch("/auth/refresh", { method: "POST", credentials: "include" })
      .then(async r => {
        if (!r.ok) throw new Error("no refresh")
        const data = await r.json()
        setAccessToken(data.access_token)
        const u = { email: data.email, nome: data.nome, role: data.role, gestor_key: data.gestor_key }
        setUser(u)
        saveCachedUser(u)
      })
      .catch(() => {
        setUser(null)
        saveCachedUser(null)
        setAccessToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{
      user, isLoading,
      login: async (email, password) => {
        const data = await apiLogin(email, password)
        const u = { email: data.email, nome: data.nome, role: data.role, gestor_key: data.gestor_key }
        setUser(u)
        saveCachedUser(u)
      },
      logout: async () => {
        await apiLogout()
        setUser(null)
        saveCachedUser(null)
      },
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be inside AuthProvider")
  return ctx
}
