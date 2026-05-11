import { useState } from "react"
import { useFormOptions, useCreateTask } from "../api/hooks"
import { gold, card, border, textSecondary, textTertiary, pill } from "../styles/theme"

interface Props { gestor: { nome: string; key: string }; role: string }

export default function NovaTarefa({ gestor, role }: Props) {
  const [nicho, setNicho] = useState("")
  const [regiao, setRegiao] = useState("BR")
  const [oferta, setOferta] = useState("")
  const [fonte, setFonte] = useState("")
  const [creativeName, setCreativeName] = useState("")
  const [link, setLink] = useState("")
  const [gestorKey, setGestorKey] = useState(gestor.key)
  const [success, setSuccess] = useState<string | null>(null)

  const { data: options } = useFormOptions()
  const createMutation = useCreateTask()

  // Visitante should never reach here (tab hidden), but guard anyway
  if (role === "visitante") {
    return (
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
        <p style={{ color: textSecondary, fontSize: 15, marginBottom: 8 }}>Acesso restrito</p>
        <p style={{ color: textTertiary, fontSize: 13 }}>Visitantes nao podem criar tarefas.</p>
      </div>
    )
  }

  const isGestor = role === "gestor"

  function handleCreate() {
    if (!nicho || !oferta || !fonte || !creativeName) return
    createMutation.mutate(
      { nicho, regiao, oferta, fonte, creative_name: creativeName, material_link: link, gestor_key: isGestor ? gestor.key : gestorKey },
      { onSuccess: (data: any) => { setSuccess(data.task_name); setCreativeName(""); setLink("") } },
    )
  }

  const previewName = nicho && oferta && fonte && creativeName
    ? `[${nicho}][${regiao}][${oferta}][${fonte}][${creativeName}]`
    : ""

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", background: "transparent", border: `1px solid ${border}`,
    borderRadius: 8, color: "#eceef2", fontSize: 14, boxSizing: "border-box",
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle, appearance: "none" as const, cursor: "pointer",
  }

  const labelStyle: React.CSSProperties = {
    color: textSecondary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "block",
  }

  return (
    <div>
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 24 }}>

        {success && (
          <div style={{ background: "rgba(45,212,160,0.12)", border: "1px solid rgba(45,212,160,0.3)", borderRadius: 8, padding: 12, marginBottom: 20 }}>
            <p style={{ color: "#2dd4a0", fontSize: 13 }}>Tarefa criada: <strong>{success}</strong></p>
            <button onClick={() => setSuccess(null)} style={{ color: "#2dd4a0", background: "none", border: "none", fontSize: 11, cursor: "pointer", marginTop: 4 }}>Criar outra</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Nicho */}
          <div>
            <label style={labelStyle}>Nicho</label>
            <select value={nicho} onChange={e => setNicho(e.target.value)} style={selectStyle}>
              <option value="">Selecione...</option>
              {(options?.nichos || []).map((n: any) => <option key={n.code} value={n.code}>{n.label}</option>)}
            </select>
          </div>

          {/* Regiao */}
          <div>
            <label style={labelStyle}>Regiao</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["BR", "EUA"].map(r => (
                <button key={r} onClick={() => setRegiao(r)} style={pill(regiao === r)}>{r === "BR" ? "Brasil" : "EUA"}</button>
              ))}
            </div>
          </div>

          {/* Oferta */}
          <div>
            <label style={labelStyle}>Oferta</label>
            <select value={oferta} onChange={e => setOferta(e.target.value)} style={selectStyle}>
              <option value="">Selecione...</option>
              {(options?.ofertas || []).map((o: any) => <option key={o.code} value={o.code}>{o.label}</option>)}
            </select>
          </div>

          {/* Fonte */}
          <div>
            <label style={labelStyle}>Fonte</label>
            <select value={fonte} onChange={e => setFonte(e.target.value)} style={selectStyle}>
              <option value="">Selecione...</option>
              {(options?.fontes || []).map((f: any) => <option key={f.code} value={f.code}>{f.label}</option>)}
            </select>
          </div>
        </div>

        {/* Creative name */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Nome do Criativo</label>
          <input value={creativeName} onChange={e => setCreativeName(e.target.value)} placeholder="Ex: ADC88V2 V122-V148" style={inputStyle} />
        </div>

        {/* Link */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Link do Material</label>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." style={inputStyle} />
        </div>

        {/* Gestor */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Gestor que subiu</label>
          {isGestor ? (
            <div style={{ ...inputStyle, background: "rgba(212,168,71,0.08)", borderColor: gold + "44", display: "flex", alignItems: "center" }}>
              {gestor.nome}
            </div>
          ) : (
            <select value={gestorKey} onChange={e => setGestorKey(e.target.value)} style={selectStyle}>
              {(options?.gestores || []).map((g: any) => <option key={g.key} value={g.key}>{g.nome}</option>)}
            </select>
          )}
        </div>

        {/* Preview */}
        {previewName && (
          <div style={{ background: "#181b24", border: `1px solid ${border}`, borderRadius: 8, padding: 12, marginBottom: 20 }}>
            <p style={{ color: textTertiary, fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>Preview</p>
            <p style={{ fontFamily: "monospace", fontSize: 13, color: "#eceef2" }}>{previewName}</p>
          </div>
        )}

        <button onClick={handleCreate} disabled={createMutation.isPending || !nicho || !oferta || !fonte || !creativeName}
          style={{
            width: "100%", padding: 14, background: (!nicho || !oferta || !fonte || !creativeName || createMutation.isPending) ? "#555a6e" : gold,
            color: "#08090c", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: (!nicho || !oferta || !fonte || !creativeName || createMutation.isPending) ? "not-allowed" : "pointer",
          }}>
          {createMutation.isPending ? "Criando..." : "Criar Tarefa"}
        </button>
      </div>
    </div>
  )
}
