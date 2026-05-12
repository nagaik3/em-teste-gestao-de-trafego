import { useDatalakeAssertividade } from "../api/hooks"
import { gold, card, border, textSecondary } from "../styles/theme"

function badge(taxa: number) {
  if (taxa >= 8) return { l: "Consistente", bg: "rgba(34,197,94,0.15)", c: "#22c55e" }
  if (taxa >= 5) return { l: "Medio", bg: "rgba(250,204,21,0.15)", c: "#eab308" }
  if (taxa > 0) return { l: "Baixo", bg: "rgba(249,115,22,0.15)", c: "#f97316" }
  return { l: "Sem dados", bg: "rgba(255,255,255,0.05)", c: textSecondary }
}

export default function RaioXCopy() {
  const { data, isLoading } = useDatalakeAssertividade()
  const rows = data || []

  const totalTestados = rows.reduce((s: number, r: any) => s + Number(r.testados || 0), 0)
  const totalValidados = rows.reduce((s: number, r: any) => s + Number(r.validados || 0), 0)
  const taxaGeral = totalTestados > 0 ? (totalValidados / totalTestados * 100).toFixed(1) : "0"

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: gold, fontSize: 18, fontWeight: 700, margin: 0 }}>Raio-X de Assertividade (Copy)</h2>
        <p style={{ color: textSecondary, fontSize: 12, margin: 0 }}>Super Cerebro V5: ROAS &ge; 1.8 e Vendas &ge; 10 | Data Lake</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Copywriters", value: rows.length },
          { label: "Testados", value: totalTestados },
          { label: "Validados (V5)", value: totalValidados, color: gold },
          { label: "Taxa Geral", value: `${taxaGeral}%`, color: gold },
        ].map(k => (
          <div key={k.label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 12 }}>
            <p style={{ color: textSecondary, fontSize: 10, margin: 0 }}>{k.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: k.color || "#eceef2", margin: "4px 0 0" }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${border}` }}>
              {["Copywriter", "Produzidos", "Testados", "Validados", "Taxa", "Faturamento", "Status"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: h === "Copywriter" || h === "Status" ? "left" : "right", color: textSecondary, fontWeight: 600, fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: textSecondary }}>Carregando...</td></tr>}
            {rows.map((r: any) => {
              const taxa = Number(r.taxa_assertividade || 0)
              const b = badge(taxa)
              return (
                <tr key={r.copywriter} style={{ borderBottom: `1px solid ${border}` }}>
                  <td style={{ padding: "10px 12px", fontWeight: 700, color: "#eceef2" }}>{r.copywriter}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: textSecondary }}>{r.total_criativos}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: textSecondary }}>{r.testados}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: gold, fontWeight: 600 }}>{r.validados}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{taxa.toFixed(1)}%</span>
                      <div style={{ width: 60, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                        <div style={{ width: `${Math.min(taxa * 5, 100)}%`, height: "100%", background: gold, borderRadius: 3 }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: textSecondary }}>
                    R${Number(r.faturamento || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ background: b.bg, color: b.c, padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>{b.l}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
