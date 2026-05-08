import { useState } from "react"
import { useCounts, useTasks, useTaskDetail, useClaim } from "../api/hooks"
import { useAuth } from "../auth/AuthContext"

const NICHOS = ["EM", "MM", "DB", "ED", "DA", "NE", "PT", "ZB", "ME"]
const gold = "#D4A847", goldDim = "rgba(212,168,71,0.12)", card = "#12151c", border = "#252a38", surface = "#0d0f14"

function daysAgo(ts: number) { return Math.floor((Date.now() - ts) / 86400000) }

export default function Atribuidor() {
  const { user, logout } = useAuth()
  const [nicho, setNicho] = useState<string | null>(null)
  const [regiao, setRegiao] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const { data: counts = [] } = useCounts()
  const { data: tasks = [], isLoading, refetch } = useTasks(nicho, regiao)
  const { data: detail } = useTaskDetail(selectedId)
  const claim = useClaim()

  function getCount(n: string, r?: string) { return counts.filter(c => c.nicho === n && (!r || c.regiao === r)).reduce((s, c) => s + c.count, 0) }

  function handleClaim() {
    if (!selectedId) return
    claim.mutate({ taskId: selectedId }, {
      onSuccess: () => { setShowConfirm(false); setSelectedId(null); refetch() },
    })
  }

  const pill = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: active ? 600 : 400, border: `1px solid ${active ? gold : border}`,
    background: active ? gold : "transparent", color: active ? "#08090c" : "#8b90a0", cursor: "pointer", transition: "all 0.2s",
  })

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <h1 style={{ color: gold, fontSize: 22, fontWeight: 700, margin: 0 }}>Atribuidor de Testes</h1>
          <p style={{ color: "#8b90a0", fontSize: 13, margin: "4px 0 0" }}>{user?.nome}</p>
        </div>
        <button onClick={logout} style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 16px", color: "#8b90a0", fontSize: 12, cursor: "pointer" }}>Sair</button>
      </div>

      {/* Nicho picker */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <p style={{ color: "#8b90a0", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Nicho</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {NICHOS.map(n => {
            const total = getCount(n)
            return <button key={n} onClick={() => { setNicho(n); setRegiao(null); setSelectedId(null) }} style={{ ...pill(nicho === n), opacity: total === 0 ? 0.3 : 1, pointerEvents: total === 0 ? "none" : "auto" }}>
              {n}{total > 0 && <span style={{ marginLeft: 6, opacity: 0.7, fontFamily: "monospace" }}>{total}</span>}
            </button>
          })}
        </div>

        {nicho && <>
          <p style={{ color: "#8b90a0", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 10px" }}>Regiao</p>
          <div style={{ display: "flex", gap: 8 }}>
            {["BR", "EUA"].map(r => {
              const total = getCount(nicho, r)
              return <button key={r} onClick={() => { setRegiao(r); setSelectedId(null) }} style={{ ...pill(regiao === r), opacity: total === 0 ? 0.3 : 1, pointerEvents: total === 0 ? "none" : "auto" }}>
                {r === "BR" ? "Brasil" : "EUA"}{total > 0 && <span style={{ marginLeft: 6, opacity: 0.7, fontFamily: "monospace" }}>{total}</span>}
              </button>
            })}
          </div>
        </>}
      </div>

      {/* Task list */}
      {nicho && regiao && (
        <div>
          <p style={{ color: "#8b90a0", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
            {isLoading ? "Carregando..." : `${tasks.length} tarefa${tasks.length !== 1 ? "s" : ""}`}
          </p>
          {tasks.map(t => {
            const days = daysAgo(t.date_created)
            const sel = selectedId === t.id
            return <button key={t.id} onClick={() => setSelectedId(t.id)} style={{
              display: "block", width: "100%", textAlign: "left", background: sel ? "#1e222e" : card, border: `1px solid ${sel ? gold : border}`,
              borderLeft: `3px solid ${sel ? gold : "transparent"}`, borderRadius: 10, padding: 16, marginBottom: 8, cursor: "pointer", transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "monospace", fontSize: 13, color: "#eceef2", wordBreak: "break-all" }}>{t.name}</span>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: days >= 7 ? "#f06060" : days >= 3 ? "#f0b840" : "#555a6e", whiteSpace: "nowrap", marginLeft: 12 }}>
                  {days === 0 ? "hoje" : `${days}d`}
                </span>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {t.fonte && <span style={{ background: "rgba(91,141,239,0.12)", color: "#5b8def", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{(t.fonte).split(" - ")[0]}</span>}
                {t.copywriter && <span style={{ color: "#8b90a0", fontSize: 12 }}>{t.copywriter}</span>}
                {t.editor && <span style={{ color: "#555a6e", fontSize: 12 }}>/ {t.editor}</span>}
              </div>
            </button>
          })}
          {!isLoading && tasks.length === 0 && <p style={{ textAlign: "center", color: "#555a6e", padding: 40 }}>Nenhuma tarefa aguardando teste.</p>}
        </div>
      )}

      {/* Detail panel */}
      {selectedId && detail && !showConfirm && (
        <div style={{ position: "fixed", top: 0, right: 0, width: "min(460px, 100vw)", height: "100vh", background: surface, borderLeft: `1px solid ${border}`, overflowY: "auto", zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
          <div style={{ position: "sticky", top: 0, background: surface, borderBottom: `1px solid ${border}`, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: gold, fontWeight: 600, fontSize: 14 }}>Detalhes</span>
            <button onClick={() => setSelectedId(null)} style={{ background: "none", border: "none", color: "#8b90a0", fontSize: 18, cursor: "pointer" }}>x</button>
          </div>
          <div style={{ padding: 20 }}>
            <p style={{ fontFamily: "monospace", fontSize: 14, color: "#eceef2", wordBreak: "break-all", marginBottom: 16 }}>{detail.name}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              {[["Nicho", detail.nicho], ["Regiao", detail.regiao], ["Oferta", detail.oferta], ["Fonte", detail.fonte], ["Copywriter", detail.copywriter], ["Editor", detail.editor], ["Mes", detail.mes]].map(([k, v]) =>
                v ? <div key={k as string}><p style={{ color: "#555a6e", fontSize: 10, textTransform: "uppercase" }}>{k}</p><p style={{ color: "#eceef2", fontSize: 13, marginTop: 2 }}>{v}</p></div> : null
              )}
            </div>
            {detail.description && <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 16, maxHeight: 160, overflowY: "auto" }}><p style={{ color: "#8b90a0", fontSize: 13, whiteSpace: "pre-wrap" }}>{detail.description}</p></div>}
            {detail.checklists.map((cl, i) => (
              <div key={i} style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#8b90a0", fontSize: 12 }}>{cl.name}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: cl.items.filter(i => i.resolved).length === cl.items.length ? "#2dd4a0" : "#555a6e" }}>{cl.items.filter(i => i.resolved).length}/{cl.items.length}</span>
                </div>
                {cl.items.map((item, j) => <div key={j} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                  <span style={{ color: item.resolved ? "#2dd4a0" : "#555a6e", fontSize: 13 }}>{item.resolved ? "\u2713" : "\u25CB"}</span>
                  <span style={{ fontSize: 12, color: item.resolved ? "#8b90a0" : "#555a6e", textDecoration: item.resolved ? "line-through" : "none" }}>{item.name}</span>
                </div>)}
              </div>
            ))}
            <button onClick={() => setShowConfirm(true)} style={{ width: "100%", padding: 14, background: gold, color: "#08090c", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>Iniciar Teste</button>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 24, width: 400, maxWidth: "90vw" }}>
            <p style={{ color: gold, fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Confirmar Inicio de Teste</p>
            <p style={{ color: "#8b90a0", fontSize: 13, marginBottom: 16 }}>A tarefa sera movida para <strong style={{ color: "#eceef2" }}>Em Teste</strong> e o copywriter sera notificado.</p>
            <div style={{ background: "#181b24", border: `1px solid ${border}`, borderRadius: 8, padding: 12, marginBottom: 20 }}>
              <p style={{ fontFamily: "monospace", fontSize: 12, color: "#eceef2", wordBreak: "break-all" }}>{detail.name}</p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowConfirm(false)} disabled={claim.isPending} style={{ flex: 1, padding: 10, background: "#181b24", border: `1px solid ${border}`, borderRadius: 8, color: "#8b90a0", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleClaim} disabled={claim.isPending} style={{ flex: 1, padding: 10, background: claim.isPending ? "#555a6e" : gold, border: "none", borderRadius: 8, color: "#08090c", fontSize: 13, fontWeight: 600, cursor: claim.isPending ? "not-allowed" : "pointer" }}>
                {claim.isPending ? "Processando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
