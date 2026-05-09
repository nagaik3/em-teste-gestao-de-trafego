import { useState } from "react"
import { gold, card, border, base, textSecondary, GESTORES } from "../styles/theme"
import Atribuidor from "./Atribuidor"
import Gestao from "./Gestao"
import NovaTarefa from "./NovaTarefa"

type Tab = "atribuidor" | "gestao" | "nova-tarefa"
type Gestor = typeof GESTORES[0]

export default function App() {
  const [gestor, setGestor] = useState<Gestor | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>("gestao")

  if (!gestor) {
    return (
      <div style={{ maxWidth: 500, margin: "0 auto", padding: 24, paddingTop: 80 }}>
        <h1 style={{ color: gold, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Gestao de Testes</h1>
        <p style={{ color: textSecondary, fontSize: 14, marginBottom: 32 }}>Selecione seu nome para continuar</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {GESTORES.map(g => (
            <button key={g.key} onClick={() => setGestor(g)} style={{
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "gestao", label: "Gestao" },
    { id: "atribuidor", label: "Atribuidor" },
    { id: "nova-tarefa", label: "Nova Tarefa" },
  ]

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: gold, fontSize: 22, fontWeight: 700, margin: 0 }}>Gestao de Testes</h1>
          <p style={{ color: textSecondary, fontSize: 13, margin: "4px 0 0" }}>{gestor.nome}</p>
        </div>
        <button onClick={() => { setGestor(null); setActiveTab("gestao") }} style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 16px", color: textSecondary, fontSize: 12, cursor: "pointer" }}>
          Trocar
        </button>
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
      {activeTab === "atribuidor" && <Atribuidor gestor={gestor} />}
      {activeTab === "gestao" && <Gestao gestor={gestor} />}
      {activeTab === "nova-tarefa" && <NovaTarefa gestor={gestor} />}
    </div>
  )
}
