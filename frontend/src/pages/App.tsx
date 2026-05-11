import { useState } from "react"
import { gold, card, border, base, textSecondary, GESTORES } from "../styles/theme"
import { useAuth } from "../auth/AuthContext"
import Atribuidor from "./Atribuidor"
import Gestao from "./Gestao"
import NovaTarefa from "./NovaTarefa"

type Tab = "atribuidor" | "gestao" | "nova-tarefa"

export default function App() {
  const { user, logout } = useAuth()
  const role = user?.role || "visitante"
  const userGestorKey = user?.gestor_key || null

  // For gestor: auto-set to their own key. For admin/visitante: dropdown picker.
  const [selectedGestorKey, setSelectedGestorKey] = useState<string>(
    role === "gestor" && userGestorKey ? userGestorKey : ""
  )
  const [activeTab, setActiveTab] = useState<Tab>("gestao")

  // Resolve the active gestor object
  const gestorKey = role === "gestor" && userGestorKey ? userGestorKey : selectedGestorKey
  const gestor = GESTORES.find(g => g.key === gestorKey) || null

  // For admin/visitante: show gestor picker if none selected
  const needsGestorPick = role !== "gestor" && !gestor

  // Build tab list (hide Nova Tarefa for visitante)
  const tabs: { id: Tab; label: string }[] = [
    { id: "gestao", label: "Gestao" },
    { id: "atribuidor", label: "Atribuidor" },
    ...(role !== "visitante" ? [{ id: "nova-tarefa" as Tab, label: "Nova Tarefa" }] : []),
  ]

  // Role badge
  const roleBadge = role === "admin" ? "Admin" : role === "visitante" ? "Visitante" : null

  if (needsGestorPick) {
    return (
      <div style={{ maxWidth: 500, margin: "0 auto", padding: 24, paddingTop: 80 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
          <div>
            <h1 style={{ color: gold, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Gestao de Testes</h1>
            <p style={{ color: textSecondary, fontSize: 14 }}>Selecione um gestor para visualizar</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {roleBadge && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(212,168,71,0.15)", color: gold, fontWeight: 600 }}>{roleBadge}</span>
            )}
            <button onClick={logout} style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 16px", color: textSecondary, fontSize: 12, cursor: "pointer" }}>
              Sair
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {GESTORES.map(g => (
            <button key={g.key} onClick={() => setSelectedGestorKey(g.key)} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", background: card, border: `1px solid ${border}`,
              borderRadius: 10, cursor: "pointer", transition: "all 0.15s", textAlign: "left",
            }}
            onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = gold }}
            onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = border }}
            >
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: gold, display: "flex", alignItems: "center", justifyContent: "center", color: base, fontWeight: 700, fontSize: 16 }}>
                {g.nome.charAt(0)}
              </div>
              <span style={{ color: "#eceef2", fontSize: 15, fontWeight: 500 }}>{g.nome}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: gold, fontSize: 22, fontWeight: 700, margin: 0 }}>Gestao de Testes</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <p style={{ color: textSecondary, fontSize: 13, margin: 0 }}>{gestor?.nome}</p>
            {roleBadge && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "rgba(212,168,71,0.15)", color: gold, fontWeight: 600 }}>{roleBadge}</span>
            )}
            {role === "visitante" && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "rgba(139,144,160,0.15)", color: textSecondary }}>somente leitura</span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {role !== "gestor" && (
            <button onClick={() => { setSelectedGestorKey(""); setActiveTab("gestao") }} style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 16px", color: textSecondary, fontSize: 12, cursor: "pointer" }}>
              Trocar
            </button>
          )}
          <button onClick={logout} style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 16px", color: textSecondary, fontSize: 12, cursor: "pointer" }}>
            Sair
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: card, borderRadius: 10, padding: 4, border: `1px solid ${border}` }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
              background: activeTab === tab.id ? gold : "transparent",
              color: activeTab === tab.id ? base : textSecondary,
              border: "none", cursor: "pointer", transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "atribuidor" && gestor && <Atribuidor gestor={gestor} role={role} />}
      {activeTab === "gestao" && gestor && <Gestao gestor={gestor} role={role} />}
      {activeTab === "nova-tarefa" && gestor && <NovaTarefa gestor={gestor} role={role} />}
    </div>
  )
}
