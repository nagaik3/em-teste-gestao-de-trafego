import { Navigate } from "react-router-dom"
import { useAuth } from "./AuthContext"
import type { ReactNode } from "react"

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", color: "#8b90a0" }}>Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
