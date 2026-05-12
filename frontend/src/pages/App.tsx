import { useState, useRef, useEffect } from "react"
import { gold, goldDim, card, border, base, surface, textPrimary, textSecondary, GESTORES } from "../styles/theme"
import { useAuth } from "../auth/AuthContext"
import Atribuidor from "./Atribuidor"
import Gestao from "./Gestao"
import NovaTarefa from "./NovaTarefa"
import KanbanEsteira from "./KanbanEsteira"
import RaioXCopy from "./RaioXCopy"
import VisaoExecutiva from "./VisaoExecutiva"

type Tab = "cockpit" | "gestao" | "atribuidor" | "nova-tarefa" | "kanban" | "raio-x"

// Dropdown component
function NavDropdown({ label, children, isOpen, onToggle }: {
  label: string; children: React.ReactNode; isOpen: boolean; onToggle: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    if (isOpen) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [isOpen, onToggle])

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={onToggle} style={{
        background: "transparent", border: "none", cursor: "pointer",
        padding: "8px 12px", borderRadius: 8, fontSize: 13, fontWeight: 500,
        color: textSecondary, transition: "all 0.15s",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = textPrimary; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = textSecondary; (e.currentTarget as HTMLElement).style.background = "transparent" }}
      >
        {label} <span style={{ fontSize: 10, marginLeft: 2 }}>▾</span>
      </button>
      {isOpen && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 4, minWidth: 200,
          background: card, border: `1px solid ${border}`, borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 100, overflow: "hidden",
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

function NavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left",
      padding: "10px 16px", fontSize: 13, fontWeight: active ? 600 : 400,
      color: active ? gold : textPrimary, background: active ? goldDim : "transparent",
      border: "none", cursor: "pointer", borderLeft: `3px solid ${active ? gold : "transparent"}`,
      transition: "all 0.12s",
    }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent" }}
    >
      {label}
    </button>
  )
}

export default function App() {
  const { user, logout } = useAuth()
  const role = user?.role || "visitante"
  const isAdmin = role === "admin"
  const userGestorKey = user?.gestor_key || null

  const [selectedGestorKey, setSelectedGestorKey] = useState<string>(
    role === "gestor" && userGestorKey ? userGestorKey : ""
  )
  const [activeTab, setActiveTab] = useState<Tab>(isAdmin ? "cockpit" : "gestao")
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const gestorKey = role === "gestor" && userGestorKey ? userGestorKey : selectedGestorKey
  const gestor = GESTORES.find(g => g.key === gestorKey) || null
  const needsGestorPick = role !== "gestor" && !gestor

  const selectTab = (tab: Tab) => { setActiveTab(tab); setOpenMenu(null) }

  // Tabs that need a gestor selected
  const gestorTabs: Tab[] = ["gestao", "atribuidor", "nova-tarefa"]
  const needsGestor = gestorTabs.includes(activeTab) && !gestor

  // Gestor picker screen
  if (needsGestorPick && gestorTabs.includes(activeTab)) {
    return (
      <div style={{ maxWidth: 500, margin: "0 auto", padding: 24, paddingTop: 80 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
          <div>
            <h1 style={{ color: gold, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              IMPERA<span style={{ color: "#5b8def" }}>.OS</span>
            </h1>
            <p style={{ color: textSecondary, fontSize: 14 }}>Selecione um gestor para visualizar</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isAdmin && (
              <button onClick={() => setActiveTab("cockpit")} style={{
                background: goldDim, border: `1px solid ${gold}`, borderRadius: 8,
                padding: "6px 14px", color: gold, fontSize: 12, cursor: "pointer", fontWeight: 600,
              }}>
                Cockpit
              </button>
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
              <span style={{ color: textPrimary, fontSize: 15, fontWeight: 500 }}>{g.nome}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: base }}>
      {/* NAVBAR */}
      <nav style={{
        background: surface, borderBottom: `1px solid ${border}`,
        padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
        height: 56, position: "sticky", top: 0, zIndex: 50,
      }}>
        {/* Left: Logo + Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -1, color: textPrimary }}>
            IMPERA<span style={{ color: "#5b8def" }}>.OS</span>
          </span>

          <div style={{ width: 1, height: 24, background: border, margin: "0 4px" }} />

          {/* Cockpit (admin only) */}
          {isAdmin && (
            <button onClick={() => selectTab("cockpit")} style={{
              background: activeTab === "cockpit" ? goldDim : "transparent",
              border: "none", cursor: "pointer", padding: "8px 12px", borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              color: activeTab === "cockpit" ? gold : textSecondary,
              transition: "all 0.15s",
            }}>
              Cockpit
            </button>
          )}

          {/* Producao dropdown (admin) */}
          {isAdmin && (
            <NavDropdown label="Producao" isOpen={openMenu === "prod"} onToggle={() => setOpenMenu(openMenu === "prod" ? null : "prod")}>
              <NavItem label="Kanban Unificado" active={activeTab === "kanban"} onClick={() => selectTab("kanban")} />
              <NavItem label="Raio-X Copy" active={activeTab === "raio-x"} onClick={() => selectTab("raio-x")} />
            </NavDropdown>
          )}

          {/* Trafego dropdown (everyone) */}
          <NavDropdown label="Trafego" isOpen={openMenu === "traf"} onToggle={() => setOpenMenu(openMenu === "traf" ? null : "traf")}>
            <NavItem label="Gestao de Testes" active={activeTab === "gestao"} onClick={() => selectTab("gestao")} />
            <NavItem label="Atribuidor" active={activeTab === "atribuidor"} onClick={() => selectTab("atribuidor")} />
            {role !== "visitante" && (
              <NavItem label="Nova Tarefa" active={activeTab === "nova-tarefa"} onClick={() => selectTab("nova-tarefa")} />
            )}
          </NavDropdown>
        </div>

        {/* Right: User info */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {gestor && (
            <>
              <span style={{ fontSize: 12, color: textSecondary }}>{gestor.nome}</span>
              {role !== "gestor" && (
                <button onClick={() => { setSelectedGestorKey(""); setActiveTab("gestao") }} style={{
                  background: "transparent", border: `1px solid ${border}`, borderRadius: 6,
                  padding: "3px 10px", color: textSecondary, fontSize: 11, cursor: "pointer",
                }}>
                  Trocar
                </button>
              )}
            </>
          )}
          {isAdmin && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: goldDim, color: gold, fontWeight: 600 }}>Admin</span>
          )}
          <button onClick={logout} style={{
            background: "transparent", border: `1px solid ${border}`, borderRadius: 6,
            padding: "4px 12px", color: textSecondary, fontSize: 12, cursor: "pointer",
          }}>
            Sair
          </button>
        </div>
      </nav>

      {/* CONTENT */}
      <div style={{ maxWidth: activeTab === "cockpit" ? 1200 : 960, margin: "0 auto", padding: 24 }}>
        {activeTab === "cockpit" && isAdmin && <VisaoExecutiva />}
        {activeTab === "kanban" && isAdmin && <KanbanEsteira />}
        {activeTab === "raio-x" && isAdmin && <RaioXCopy />}
        {activeTab === "gestao" && gestor && <Gestao gestor={gestor} role={role} />}
        {activeTab === "atribuidor" && gestor && <Atribuidor gestor={gestor} role={role} />}
        {activeTab === "nova-tarefa" && gestor && <NovaTarefa gestor={gestor} role={role} />}
      </div>
    </div>
  )
}
