export const gold = "#D4A847"
export const goldDim = "rgba(212,168,71,0.12)"
export const card = "#12151c"
export const border = "#252a38"
export const surface = "#0d0f14"
export const base = "#08090c"
export const textPrimary = "#eceef2"
export const textSecondary = "#8b90a0"
export const textTertiary = "#555a6e"

export const STATUS_COLORS: Record<string, string> = {
  "em teste": "#5b8def",
  "pré-escala": "#f0b840",
  "validado": "#2dd4a0",
  "escala": "#7c3aed",
  "em risco": "#f97316",
  "negativo": "#f06060",
  "pausado": "#8b90a0",
  "reprovado": "#555a6e",
  "aguardando teste": "#555a6e",
  "cemitério": "#6b7280",
}

export const GESTORES = [
  { nome: "Lucas Cavalcanti", key: "lucas" },
  { nome: "Ludson Chaves", key: "ludson" },
  { nome: "Douglas Oliveira", key: "douglas" },
  { nome: "Gustavo Lisner", key: "gustavo" },
  { nome: "Gabriel Fraza", key: "gabriel" },
]

export const pill = (active: boolean): React.CSSProperties => ({
  padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: active ? 600 : 400,
  border: `1px solid ${active ? gold : border}`,
  background: active ? gold : "transparent", color: active ? base : textSecondary,
  cursor: "pointer", transition: "all 0.2s",
})
