import { useDatalakeSlasAtivos, useDatalakeSlasResumo } from "../api/hooks"
import { gold, card, border, textSecondary } from "../styles/theme"

const COLUNAS = [
  { id: "Escrevendo - Copy", titulo: "Escrevendo (Copy)", cor: gold },
  { id: "Pre-Producao", titulo: "Pre-Producao", cor: "#3b82f6" },
  { id: "Producao", titulo: "Producao / Edicao", cor: "#8b5cf6" },
  { id: "Avaliacao", titulo: "Avaliacao", cor: "#06b6d4" },
  { id: "Alteracao", titulo: "Alteracao", cor: "#f59e0b" },
  { id: "Freelancer", titulo: "Freelancer", cor: "#ec4899" },
]

function corBorda(horas: number) {
  if (horas >= 24) return "#ef4444"
  if (horas >= 19) return "#f59e0b"
  return "#22c55e"
}

function fmt(h: number) {
  if (h < 1) return `${Math.round(h * 60)}min`
  if (h < 24) return `${Math.round(h)}h`
  return `${(h / 24).toFixed(1)}d`
}

export default function KanbanEsteira() {
  const { data: cards } = useDatalakeSlasAtivos()
  const { data: resumo } = useDatalakeSlasResumo()
  const items = cards || []
  const resumoData = resumo || []

  const match = (fase: string, colId: string) => {
    if (colId === "Pre-Producao") return fase.toLowerCase().includes("pr") && fase.toLowerCase().includes("produ")
    if (colId === "Avaliacao") return fase.toLowerCase().includes("avalia")
    return fase.includes(colId.split(" - ")[0]) || fase === colId
  }

  const totalAtrasadas = items.filter((c: any) => Number(c.horas_na_fase || 0) >= 24).length

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ color: gold, fontSize: 18, fontWeight: 700, margin: 0 }}>Kanban de Producao</h2>
          <p style={{ color: textSecondary, fontSize: 12, margin: 0 }}>Pipeline unificado | Dados ao vivo do Data Lake</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "3px 10px", borderRadius: 16, fontSize: 12, fontWeight: 600 }}>
            {totalAtrasadas} atrasadas
          </span>
          <span style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", padding: "3px 10px", borderRadius: 16, fontSize: 12, fontWeight: 600 }}>
            {items.length - totalAtrasadas} no prazo
          </span>
        </div>
      </div>

      {resumoData.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(resumoData.length, 3)}, 1fr)`, gap: 10, marginBottom: 16 }}>
          {resumoData.slice(0, 3).map((r: any) => (
            <div key={r.setor_fase} style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 12 }}>
              <p style={{ color: textSecondary, fontSize: 10, margin: 0 }}>{r.setor_fase}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#eceef2", margin: "4px 0 0" }}>{r.pct_atraso}%</p>
              <p style={{ color: textSecondary, fontSize: 10, margin: 0 }}>{r.estourados}/{r.total} estourados</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 12 }}>
        {COLUNAS.map(col => {
          const colCards = items.filter((c: any) => match(String(c.setor_fase || ""), col.id))
          return (
            <div key={col.id} style={{ minWidth: 240, flex: "0 0 240px", background: card, borderRadius: 10, border: `1px solid ${border}`, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "10px 12px", borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: col.cor }} />
                  <span style={{ fontWeight: 600, fontSize: 12, color: "#eceef2" }}>{col.titulo}</span>
                </div>
                <span style={{ fontSize: 10, color: textSecondary }}>{colCards.length}</span>
              </div>
              <div style={{ padding: 6, flex: 1, overflowY: "auto", maxHeight: 400 }}>
                {colCards.length === 0 && <p style={{ textAlign: "center", color: textSecondary, fontSize: 11, padding: 16 }}>Vazio</p>}
                {colCards.map((c: any, i: number) => {
                  const h = Number(c.horas_na_fase || 0)
                  const bc = corBorda(h)
                  return (
                    <div key={`${c.task_id_clickup}-${i}`} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: 10, marginBottom: 6, borderLeft: `3px solid ${bc}` }}>
                      <p style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#eceef2", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {String(c.nome || c.task_id_clickup || "?").slice(0, 40)}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: textSecondary }}>
                        <span>{String(c.responsavel || c.copywriter || "N/A")}</span>
                        <span style={{ color: bc, fontWeight: 600 }}>{h >= 24 ? `Atraso (${fmt(h)})` : fmt(h)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
