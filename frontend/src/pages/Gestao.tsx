import { useState } from "react"
import { useGestaoTasks, useTaskCreatives, useMoveCreative } from "../api/hooks"
import { gold, goldDim, card, border, surface, textSecondary, textTertiary, STATUS_COLORS } from "../styles/theme"

interface Props { gestor: { nome: string; key: string } }

const DEST_STATUSES = ["pré-escala", "validado", "escala", "em risco", "negativo", "cemitério", "pausado"]

export default function Gestao({ gestor }: Props) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [moveModal, setMoveModal] = useState<{ code: string; suggestion?: string } | null>(null)
  const [destStatus, setDestStatus] = useState("")
  const [moveError, setMoveError] = useState("")

  const { data, isLoading, refetch: refetchTasks } = useGestaoTasks(gestor.key)
  const { data: creativeData, refetch: refetchCreatives } = useTaskCreatives(selectedTaskId, gestor.key)
  const moveMutation = useMoveCreative()
  const [parentMoved, setParentMoved] = useState("")

  function handleMove() {
    if (!selectedTaskId || !moveModal || !destStatus) return
    setMoveError("")
    setParentMoved("")
    moveMutation.mutate(
      { taskId: selectedTaskId, creativeCode: moveModal.code, destinationStatus: destStatus, gestorNome: gestor.nome },
      {
        onSuccess: (res: any) => {
          setMoveModal(null); setDestStatus(""); setMoveError("")
          refetchCreatives()
          if (res?.parent_action) {
            const newStatus = res.parent_action.replace("parent_moved_to_", "")
            setParentMoved(newStatus)
            refetchTasks()
            setTimeout(() => { setParentMoved(""); setSelectedTaskId(null) }, 3000)
          }
        },
        onError: (err: any) => { setMoveError(err?.message || "Erro ao mover criativo. Tente novamente.") },
      },
    )
  }

  const groups = data?.groups || []

  return (
    <div>
      {isLoading && <p style={{ color: textSecondary, textAlign: "center", padding: 40 }}>Carregando tarefas...</p>}

      {!isLoading && groups.length === 0 && <p style={{ color: textTertiary, textAlign: "center", padding: 40 }}>Nenhuma tarefa ativa.</p>}

      {/* Status groups */}
      {groups.map(group => (
        <div key={group.status} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_COLORS[group.status] || textTertiary }} />
            <span style={{ color: "#eceef2", fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{group.status}</span>
            <span style={{ color: textTertiary, fontSize: 12, fontFamily: "monospace" }}>{group.count}</span>
          </div>

          {group.tasks.map((t: any) => {
            const sel = selectedTaskId === t.id
            return (
              <button key={t.id} onClick={() => setSelectedTaskId(sel ? null : t.id)} style={{
                display: "block", width: "100%", textAlign: "left", background: sel ? "#1e222e" : card,
                border: `1px solid ${sel ? gold : border}`, borderLeft: `3px solid ${sel ? gold : STATUS_COLORS[group.status] || "transparent"}`,
                borderRadius: 10, padding: 14, marginBottom: 6, cursor: "pointer", transition: "all 0.15s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#eceef2", wordBreak: "break-all" }}>{t.name}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 8, flexShrink: 0 }}>
                    {t.has_alert && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f0b840", display: "inline-block" }} />}
                    <span style={{ fontSize: 11, color: textTertiary, fontFamily: "monospace" }}>
                      {t.moved_count > 0 ? `${t.moved_count}/` : ""}{t.creative_count > 0 ? t.creative_count : ""}
                    </span>
                  </div>
                </div>
                {(t.fonte || t.copywriter) && (
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {t.fonte && <span style={{ background: "rgba(91,141,239,0.12)", color: "#5b8def", padding: "1px 6px", borderRadius: 999, fontSize: 10, fontWeight: 600 }}>{t.fonte?.split(" - ")[0]}</span>}
                    {t.copywriter && <span style={{ color: textSecondary, fontSize: 11 }}>{t.copywriter}</span>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      ))}

      {/* Parent moved notification */}
      {parentMoved && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 70, background: "#1a2e1a", border: "1px solid #2dd4a0", borderRadius: 10, padding: "12px 24px", color: "#2dd4a0", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
          Todos os criativos movidos — tarefa pai movida para <span style={{ textTransform: "capitalize" }}>{parentMoved}</span>
        </div>
      )}

      {/* Creative detail panel */}
      {selectedTaskId && creativeData && !moveModal && (
        <div style={{ position: "fixed", top: 0, right: 0, width: "min(480px, 100vw)", height: "100vh", background: surface, borderLeft: `1px solid ${border}`, overflowY: "auto", zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
          <div style={{ position: "sticky", top: 0, background: surface, borderBottom: `1px solid ${border}`, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ color: gold, fontWeight: 600, fontSize: 14 }}>Criativos</span>
              <span style={{ color: textTertiary, fontSize: 12, marginLeft: 8, fontFamily: "monospace" }}>{creativeData.moved}/{creativeData.total}</span>
            </div>
            <button onClick={() => setSelectedTaskId(null)} style={{ background: "none", border: "none", color: textSecondary, fontSize: 18, cursor: "pointer" }}>x</button>
          </div>

          <div style={{ padding: "12px 20px" }}>
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#eceef2", wordBreak: "break-all", marginBottom: 16 }}>{creativeData.task.name}</p>

            {creativeData.creatives.map((c: any) => {
              const perf = c.performance
              const hasSuggestion = perf?.suggestion
              return (
                <div key={c.code} style={{
                  background: c.already_moved ? "#0d0f14" : card, border: `1px solid ${c.already_moved ? "#1a1d24" : hasSuggestion ? gold + "44" : border}`,
                  borderRadius: 8, padding: 12, marginBottom: 6, opacity: c.already_moved ? 0.5 : 1,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 13, color: "#eceef2", fontWeight: 600 }}>{c.code === "_SINGLE" ? creativeData.task.name : c.code}</span>
                      {c.already_moved && (
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: STATUS_COLORS[c.existing_status] + "22", color: STATUS_COLORS[c.existing_status] || textTertiary }}>
                          {c.existing_status}
                        </span>
                      )}
                      {hasSuggestion && !c.already_moved && (
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: STATUS_COLORS[perf.suggestion] ? STATUS_COLORS[perf.suggestion] + "22" : goldDim, color: STATUS_COLORS[perf.suggestion] || gold }}>
                          {perf.suggestion_label}
                        </span>
                      )}
                    </div>
                    {!c.already_moved && (
                      <button onClick={() => { setMoveModal({ code: c.code, suggestion: perf?.suggestion }); setDestStatus(perf?.suggestion || "") }}
                        style={{ background: gold, color: "#08090c", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        Mover
                      </button>
                    )}
                  </div>
                  {perf && !c.already_moved && (
                    <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, fontFamily: "monospace" }}>
                      <span style={{ color: textSecondary }}>R${perf.cost}</span>
                      <span style={{ color: perf.vendas > 0 ? "#2dd4a0" : textTertiary }}>{perf.vendas} vendas</span>
                      <span style={{ color: perf.roas >= 1.8 ? "#2dd4a0" : perf.roas >= 1.0 ? "#f0b840" : "#f06060" }}>ROAS {perf.roas}</span>
                      {perf.cpa && <span style={{ color: perf.cpa <= 180 ? "#2dd4a0" : "#f06060" }}>CPA R${perf.cpa}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Move modal */}
      {moveModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 24, width: 380, maxWidth: "90vw" }}>
            <p style={{ color: gold, fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Mover Criativo</p>
            <p style={{ color: textSecondary, fontSize: 13, marginBottom: 16 }}>
              <strong style={{ color: "#eceef2" }}>{moveModal.code === "_SINGLE" ? "Tarefa" : moveModal.code}</strong> sera {moveModal.code === "_SINGLE" ? "movida para o" : "criado como subtarefa no"} status selecionado.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
              {DEST_STATUSES.map(s => (
                <button key={s} onClick={() => setDestStatus(s)} style={{
                  padding: "10px 14px", borderRadius: 8, textAlign: "left", fontSize: 13,
                  background: destStatus === s ? (STATUS_COLORS[s] || gold) + "22" : "#181b24",
                  border: `1px solid ${destStatus === s ? STATUS_COLORS[s] || gold : border}`,
                  color: destStatus === s ? STATUS_COLORS[s] || gold : textSecondary,
                  cursor: "pointer", transition: "all 0.15s", textTransform: "capitalize",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[s] || textTertiary }} />
                    {s}
                  </div>
                </button>
              ))}
            </div>

            {moveError && <p style={{ color: "#f06060", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "rgba(240,96,96,0.1)", borderRadius: 6 }}>{moveError}</p>}

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => { setMoveModal(null); setDestStatus(""); setMoveError("") }} disabled={moveMutation.isPending}
                style={{ flex: 1, padding: 10, background: "#181b24", border: `1px solid ${border}`, borderRadius: 8, color: textSecondary, fontSize: 13, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={handleMove} disabled={moveMutation.isPending || !destStatus}
                style={{ flex: 1, padding: 10, background: !destStatus || moveMutation.isPending ? "#555a6e" : gold, border: "none", borderRadius: 8, color: "#08090c", fontSize: 13, fontWeight: 600, cursor: !destStatus || moveMutation.isPending ? "not-allowed" : "pointer" }}>
                {moveMutation.isPending ? "Criando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
