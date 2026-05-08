import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { apiGet, apiPost } from "../api/client"

interface User { email: string; nome: string; role: string }
interface Ctx { user: User | null; isLoading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => Promise<void> }

const AuthContext = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    apiGet<User>("/auth/me").then(setUser).catch(() => setUser(null)).finally(() => setIsLoading(false))
  }, [])

  return (
    <AuthContext.Provider value={{
      user, isLoading,
      login: async (email, password) => { setUser(await apiPost<User>("/auth/login", { email, password })) },
      logout: async () => { await apiPost("/auth/logout"); setUser(null) },
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
