import { useDatalakePerformanceResumo, useDatalakeSlasResumo, useDatalakeAssertividade } from "../api/hooks"
import { gold, goldDim, card, border, textSecondary, textPrimary, base } from "../styles/theme"

const BRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0)

const accent = { blue: "#5b8def", red: "#ef4444", green: "#22c55e", yellow: "#f0b840", indigo: "#818cf8" }

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: textSecondary, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, color: color || textPrimary, margin: "4px 0 0", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: textSecondary, margin: "2px 0 0" }}>{sub}</p>}
    </div>
  )
}

export default function VisaoExecutiva() {
  const { data: perf, isLoading: loadPerf } = useDatalakePerformanceResumo()
  const { data: slasRaw } = useDatalakeSlasResumo()
  const { data: copyRaw } = useDatalakeAssertividade()

  const p = perf || {} as any
  const slas = (slasRaw || []) as any[]
  const copywriters = (copyRaw || []) as any[]

  const mcBr = Number(p.mc_br_total || 0)
  const roas = Number(p.roas_geral || 0)
  const fatTotal = Number(p.fat_total || 0)
  const custoTotal = Number(p.custo_total || 0)
  const vendasTotal = Number(p.vendas_total || 0)
  const adsMatch = Number(p.ads_com_match || 0)
  const adsSem = Number(p.ads_sem_match || 0)
  const totalAds = Number(p.total_ads || 0)
  const pctMatch = totalAds > 0 ? Math.round(adsMatch / totalAds * 100) : 0

  // SLA gargalos
  const findSla = (keyword: string) => slas.find((s: any) => String(s.setor_fase || "").toLowerCase().includes(keyword)) || {} as any
  const freelancer = findSla("freelancer")
  const preProd = findSla("pr")
  const producao = findSla("produ") && !String(findSla("produ").setor_fase || "").toLowerCase().includes("pr") ? findSla("produ") : slas.find((s: any) => s.setor_fase === "Producao") || {} as any
  const copy = findSla("escrevendo")

  // Assertividade
  const totalTestados = copywriters.reduce((s: number, r: any) => s + Number(r.testados || 0), 0)
  const totalValidados = copywriters.reduce((s: number, r: any) => s + Number(r.validados || 0), 0)
  const taxaGeral = totalTestados > 0 ? (totalValidados / totalTestados * 100).toFixed(1) : "0"
  const topCopy = [...copywriters].sort((a: any, b: any) => Number(b.taxa_assertividade || 0) - Number(a.taxa_assertividade || 0)).slice(0, 4)

  if (loadPerf) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
        <p style={{ color: textSecondary, fontSize: 14 }}>Carregando cockpit...</p>
      </div>
    )
  }

  const pillarHeader = (title: string, color: string) => ({
    background: color, padding: "10px 16px", borderBottom: `1px solid ${color}`,
  } as React.CSSProperties)

  const pillarCard = {
    background: card, borderRadius: 12, border: `1px solid ${border}`, overflow: "hidden",
  } as React.CSSProperties

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h2 style={{ color: gold, fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Cockpit Executivo</h2>
          <p style={{ color: textSecondary, fontSize: 12, margin: "4px 0 0" }}>Visao em tempo real da operacao IMPERA</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: accent.green, animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 11, color: textSecondary, fontFamily: "monospace" }}>Ao Vivo (PostgreSQL)</span>
        </div>
      </div>

      {/* KPIs top row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 14 }}>
          <KpiCard label="MC BR" value={BRL(mcBr)} color={mcBr >= 0 ? accent.green : accent.red} />
        </div>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 14 }}>
          <KpiCard label="ROAS Front" value={roas.toFixed(2)} color={roas >= 1.8 ? accent.green : accent.yellow} />
        </div>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 14 }}>
          <KpiCard label="Faturamento Front" value={BRL(fatTotal)} />
        </div>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 14 }}>
          <KpiCard label="Vendas" value={vendasTotal.toLocaleString("pt-BR")} sub={`CPA ${custoTotal > 0 && vendasTotal > 0 ? BRL(custoTotal / vendasTotal) : "N/A"}`} />
        </div>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 14 }}>
          <KpiCard label="Cruzamento RT↔CU" value={`${pctMatch}%`} sub={`${adsMatch} de ${totalAds} ads`} color={pctMatch >= 80 ? accent.green : accent.yellow} />
        </div>
      </div>

      {/* 3 Pilares */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

        {/* PILAR 1: TRAFEGO */}
        <div style={pillarCard}>
          <div style={pillarHeader("Trafego Pago (Caixa)", accent.blue)}>
            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 13, margin: 0 }}>Trafego Pago (Caixa)</h3>
          </div>
          <div style={{ padding: 16 }}>
            <KpiCard label="Margem de Contribuicao (MC BR)" value={BRL(mcBr)} color={mcBr >= 0 ? accent.green : accent.red} />

            <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${border}`, paddingTop: 12, marginTop: 14 }}>
              <div>
                <p style={{ fontSize: 10, color: textSecondary, margin: 0 }}>ROAS Front</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: roas >= 1.8 ? accent.green : accent.yellow, margin: "2px 0 0" }}>{roas.toFixed(2)}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 10, color: textSecondary, margin: 0 }}>Fat. Front</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: textPrimary, margin: "2px 0 0" }}>{BRL(fatTotal)}</p>
              </div>
            </div>

            {/* Alerta orfaos */}
            <div style={{
              marginTop: 14, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: accent.red }}>{adsSem} Criativos Orfaos</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: accent.red }}>sem rastreio</span>
            </div>
          </div>
        </div>

        {/* PILAR 2: PRODUCAO */}
        <div style={pillarCard}>
          <div style={{ ...pillarHeader("Producao & Edicao", "#374151"), background: "#1f2937" }}>
            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 13, margin: 0 }}>Producao & Edicao</h3>
          </div>
          <div style={{ padding: 16 }}>
            <KpiCard label="Status Pipeline" value="Ativo" sub={`${slas.reduce((s: number, r: any) => s + Number(r.total || 0), 0)} transicoes rastreadas`} />

            <div style={{ borderTop: `1px solid ${border}`, paddingTop: 12, marginTop: 14 }}>
              <p style={{ fontSize: 10, color: textSecondary, fontWeight: 600, textTransform: "uppercase", margin: "0 0 8px" }}>Gargalos Criticos (SLA)</p>

              {[
                { label: "Freelancers", pct: Number(freelancer.pct_atraso || 0), media: freelancer.media_horas },
                { label: "Pre-Producao", pct: Number(preProd.pct_atraso || 0), media: preProd.media_horas },
                { label: "Escrevendo (Copy)", pct: Number(copy.pct_atraso || 0), media: copy.media_horas },
              ].map(g => (
                <div key={g.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: textPrimary }}>{g.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {g.media && <span style={{ fontSize: 10, color: textSecondary }}>media {g.media}h</span>}
                    <span style={{
                      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: g.pct > 50 ? "rgba(239,68,68,0.15)" : g.pct > 30 ? "rgba(250,204,21,0.15)" : "rgba(34,197,94,0.15)",
                      color: g.pct > 50 ? accent.red : g.pct > 30 ? accent.yellow : accent.green,
                    }}>
                      {g.pct}% atraso
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PILAR 3: COPY */}
        <div style={pillarCard}>
          <div style={{ ...pillarHeader("Assertividade Copy", accent.indigo), background: "#4338ca" }}>
            <h3 style={{ color: "#fff", fontWeight: 700, fontSize: 13, margin: 0 }}>Assertividade de Copy</h3>
          </div>
          <div style={{ padding: 16 }}>
            <KpiCard label="Metrica Super Cerebro V5" value={`${taxaGeral}%`} sub={`${totalValidados} validados de ${totalTestados} testados`} />

            <div style={{ borderTop: `1px solid ${border}`, paddingTop: 12, marginTop: 14 }}>
              <p style={{ fontSize: 10, color: textSecondary, fontWeight: 600, textTransform: "uppercase", margin: "0 0 8px" }}>Top Copywriters (ao vivo)</p>

              {topCopy.map((c: any, i: number) => {
                const taxa = Number(c.taxa_assertividade || 0)
                return (
                  <div key={c.copywriter} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: textPrimary, minWidth: 80 }}>
                      {i + 1}. {c.copywriter}
                    </span>
                    <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                      <div style={{ width: `${Math.min(taxa * 5, 100)}%`, height: "100%", background: accent.indigo, borderRadius: 3, transition: "width 0.5s" }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: accent.indigo, minWidth: 36, textAlign: "right" }}>{taxa.toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
