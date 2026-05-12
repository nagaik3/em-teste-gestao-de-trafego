import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { apiGet, apiPost } from "../api/client"

interface User { email: string; nome: string; role: string; gestor_key: string | null }
interface Ctx { user: User | null; isLoading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => Promise<void> }

const AuthContext = createContext<Ctx | null>(null)

function loadUser(): User | null {
  try { const s = sessionStorage.getItem("impera_user"); return s ? JSON.parse(s) : null } catch { return null }
}

function saveUser(u: User | null) {
  if (u) sessionStorage.setItem("impera_user", JSON.stringify(u))
  else sessionStorage.removeItem("impera_user")
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser)
  const [isLoading, setIsLoading] = useState(!loadUser())

  useEffect(() => {
    // If we have a cached user, validate the cookie still works
    // If no cached user, try /auth/me (cookie might exist from previous session)
    apiGet<User>("/auth/me")
      .then(u => { setUser(u); saveUser(u) })
      .catch(() => { setUser(null); saveUser(null) })
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{
      user, isLoading,
      login: async (email, password) => {
        const u = await apiPost<User>("/auth/login", { email, password })
        setUser(u); saveUser(u)
      },
      logout: async () => {
        await apiPost("/auth/logout").catch(() => {})
        setUser(null); saveUser(null)
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
