import { useState } from "react"
import { useAuth } from "../auth/AuthContext"
import { useNavigate } from "react-router-dom"

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError("")
    try { await login(email, password); nav("/", { replace: true }) }
    catch (err: any) { setError(err?.message || "Credenciais invalidas") }
    finally { setLoading(false) }
  }

  const gold = "#D4A847"
  const card = "#12151c"
  const border = "#252a38"

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#08090c" }}>
      <form onSubmit={handleSubmit} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 32, width: 360 }}>
        <h1 style={{ color: gold, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>IMPERA</h1>
        <p style={{ color: "#8b90a0", fontSize: 13, marginBottom: 24 }}>Gestao de Testes</p>
        {error && <p style={{ color: "#f06060", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" required
          style={{ width: "100%", padding: "10px 12px", marginBottom: 12, background: "transparent", border: `1px solid ${border}`, borderRadius: 8, color: "#eceef2", fontSize: 14, boxSizing: "border-box" }} />
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" type="password" required
          style={{ width: "100%", padding: "10px 12px", marginBottom: 20, background: "transparent", border: `1px solid ${border}`, borderRadius: 8, color: "#eceef2", fontSize: 14, boxSizing: "border-box" }} />
        <button type="submit" disabled={loading}
          style={{ width: "100%", padding: 12, background: gold, color: "#08090c", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  )
}
