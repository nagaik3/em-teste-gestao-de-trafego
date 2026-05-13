"""
Data Lake IMPERA — Endpoints para views do Star Schema.
Alimenta Kanban de Producao e Raio-X de Assertividade.
Somente admin pode acessar durante homologacao.
"""

import os
import psycopg2
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request
from app.auth import get_current_user

router = APIRouter(prefix="/api/datalake", tags=["datalake"])

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


def _query(sql, params=None):
    """Execute SELECT and return list of dicts."""
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


def _require_admin(request: Request):
    user = get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# === PERFORMANCE FINANCEIRA ===

@router.get("/performance/resumo")
def performance_resumo(request: Request):
    _require_admin(request)

    # MTD (Month to Date)
    mtd = _query("""
        SELECT COUNT(*) AS total_ads,
               COALESCE(SUM(custo), 0) AS custo_total,
               COALESCE(SUM(fat_front), 0) AS fat_total,
               COALESCE(SUM(vendas), 0) AS vendas_total,
               ROUND(SUM(fat_front) / NULLIF(SUM(custo), 0), 2) AS roas_geral,
               ROUND((SUM(fat_front) * 0.74) - (SUM(custo) * 1.12), 2) AS mc_br_total,
               COUNT(*) FILTER (WHERE nicho IS NOT NULL) AS ads_com_match,
               COUNT(*) FILTER (WHERE nicho IS NULL) AS ads_sem_match
        FROM impera.view_performance_financeira
        WHERE data_registro >= DATE_TRUNC('month', CURRENT_DATE)
    """)
    result = mtd[0] if mtd else {}

    # Hoje
    hoje = _query("""
        SELECT COALESCE(SUM(custo), 0) AS custo,
               COALESCE(SUM(fat_front), 0) AS fat,
               COALESCE(SUM(vendas), 0) AS vendas,
               ROUND(SUM(fat_front) / NULLIF(SUM(custo), 0), 2) AS roas
        FROM impera.view_performance_financeira
        WHERE data_registro = CURRENT_DATE
    """)
    h = hoje[0] if hoje else {}

    # Ontem
    ontem = _query("""
        SELECT COALESCE(SUM(custo), 0) AS custo,
               COALESCE(SUM(fat_front), 0) AS fat,
               COALESCE(SUM(vendas), 0) AS vendas,
               ROUND(SUM(fat_front) / NULLIF(SUM(custo), 0), 2) AS roas
        FROM impera.view_performance_financeira
        WHERE data_registro = CURRENT_DATE - 1
    """)
    o = ontem[0] if ontem else {}

    # Deltas percentuais (hoje vs ontem)
    def delta(atual, anterior):
        a, b = float(atual or 0), float(anterior or 0)
        if b == 0:
            return None
        return round((a - b) / b * 100, 1)

    result["hoje_custo"] = float(h.get("custo", 0))
    result["hoje_fat"] = float(h.get("fat", 0))
    result["hoje_vendas"] = int(h.get("vendas", 0))
    result["hoje_roas"] = float(h.get("roas") or 0)
    result["ontem_custo"] = float(o.get("custo", 0))
    result["ontem_fat"] = float(o.get("fat", 0))
    result["ontem_vendas"] = int(o.get("vendas", 0))
    result["ontem_roas"] = float(o.get("roas") or 0)
    result["delta_fat"] = delta(h.get("fat"), o.get("fat"))
    result["delta_custo"] = delta(h.get("custo"), o.get("custo"))
    result["delta_vendas"] = delta(h.get("vendas"), o.get("vendas"))
    result["delta_roas"] = delta(h.get("roas"), o.get("roas"))

    return result


@router.get("/performance/por-gestor")
def performance_por_gestor(request: Request):
    _require_admin(request)
    return _query("""
        SELECT gestor, COUNT(*) AS campanhas,
               ROUND(SUM(custo)::numeric, 0) AS custo,
               ROUND(SUM(fat_front)::numeric, 0) AS faturamento,
               SUM(vendas) AS vendas,
               ROUND(SUM(fat_front) / NULLIF(SUM(custo), 0), 2) AS roas,
               ROUND((SUM(fat_front) * 0.74) - (SUM(custo) * 1.12), 2) AS mc_br
        FROM impera.view_performance_financeira
        GROUP BY gestor ORDER BY SUM(fat_front) DESC
    """)


@router.get("/performance/classificacao")
def performance_classificacao(request: Request):
    _require_admin(request)
    return _query("""
        SELECT status_escala, COUNT(*) AS qtd,
               ROUND(SUM(custo)::numeric, 0) AS custo,
               ROUND(SUM(fat_front)::numeric, 0) AS faturamento,
               SUM(vendas) AS vendas,
               ROUND(SUM(fat_front) / NULLIF(SUM(custo), 0), 2) AS roas
        FROM impera.view_performance_financeira
        GROUP BY status_escala ORDER BY SUM(fat_front) DESC
    """)


# === SLAs ESTEIRA ===

@router.get("/slas/ativos")
def slas_ativos(request: Request):
    _require_admin(request)
    return _query("""
        SELECT s.task_id_clickup,
               d.nome_nomenclatura AS nome, d.copywriter, d.editor, d.nicho,
               s.setor_fase, s.data_entrada, s.tempo_gasto_horas, s.sla_estourado,
               EXTRACT(EPOCH FROM (NOW() - s.data_entrada)) / 3600 AS horas_na_fase,
               CASE WHEN s.setor_fase IN ('Escrevendo - Copy') THEN d.copywriter ELSE d.editor END AS responsavel
        FROM impera.fact_slas_esteira s
        LEFT JOIN impera.dim_criativos_clickup d ON s.task_id_clickup = d.task_id_clickup
        WHERE s.data_saida IS NULL
        ORDER BY EXTRACT(EPOCH FROM (NOW() - s.data_entrada)) DESC
    """)


@router.get("/slas/resumo")
def slas_resumo(request: Request):
    _require_admin(request)
    return _query("""
        SELECT setor_fase, COUNT(*) AS total,
               SUM(CASE WHEN sla_estourado THEN 1 ELSE 0 END) AS estourados,
               ROUND(AVG(tempo_gasto_horas)::numeric, 1) AS media_horas,
               ROUND(SUM(CASE WHEN sla_estourado THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS pct_atraso
        FROM impera.fact_slas_esteira
        GROUP BY setor_fase ORDER BY pct_atraso DESC
    """)


@router.get("/slas/volume")
def slas_volume(request: Request):
    """Volume entregue: transicoes concluidas na semana e no mes."""
    _require_admin(request)
    rows = _query("""
        SELECT
            COUNT(*) FILTER (WHERE data_saida >= DATE_TRUNC('week', CURRENT_DATE)) AS semana,
            COUNT(*) FILTER (WHERE data_saida >= DATE_TRUNC('month', CURRENT_DATE)) AS mes
        FROM impera.fact_slas_esteira
        WHERE data_saida IS NOT NULL
    """)
    return rows[0] if rows else {"semana": 0, "mes": 0}


# === ORFAOS ===

@router.get("/orfaos/resumo")
def orfaos_resumo(request: Request):
    _require_admin(request)
    resumo = _query("""
        SELECT COUNT(*) AS total_orfaos,
               COALESCE(SUM(custo), 0) AS custo_vazando,
               COALESCE(SUM(fat_front), 0) AS fat_sem_rastreio
        FROM impera.view_criativos_orfaos
    """)
    result = resumo[0] if resumo else {}
    result["por_gestor"] = _query("""
        SELECT gestor, COUNT(*) AS qtd, ROUND(SUM(custo)::numeric, 0) AS custo
        FROM impera.view_criativos_orfaos GROUP BY gestor ORDER BY SUM(custo) DESC
    """)
    return result


# === ASSERTIVIDADE ===

@router.get("/assertividade")
def assertividade(request: Request):
    _require_admin(request)
    return _query("""
        WITH produzidos AS (
            SELECT copywriter, COUNT(DISTINCT base_ref) AS total_criativos
            FROM impera.dim_criativos_clickup WHERE copywriter IS NOT NULL GROUP BY copywriter
        ),
        validados AS (
            SELECT d.copywriter, COUNT(DISTINCT p.base_ref) AS criativos_validados,
                   ROUND(SUM(p.fat_front)::numeric, 0) AS faturamento_validados
            FROM impera.fact_performance_redtrack p
            JOIN impera.dim_criativos_clickup d ON p.base_ref = d.base_ref
            WHERE d.copywriter IS NOT NULL AND p.vendas >= 10
              AND ROUND(p.fat_front / NULLIF(p.custo, 0), 2) >= 1.8
              AND p.data_registro >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY d.copywriter
        ),
        testados AS (
            SELECT d.copywriter, COUNT(DISTINCT p.base_ref) AS criativos_testados,
                   ROUND(SUM(p.custo)::numeric, 0) AS custo_total,
                   ROUND(SUM(p.fat_front)::numeric, 0) AS faturamento_total,
                   SUM(p.vendas) AS vendas_total
            FROM impera.fact_performance_redtrack p
            JOIN impera.dim_criativos_clickup d ON p.base_ref = d.base_ref
            WHERE d.copywriter IS NOT NULL
              AND p.data_registro >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY d.copywriter
        )
        SELECT pr.copywriter, pr.total_criativos,
               COALESCE(t.criativos_testados, 0) AS testados,
               COALESCE(v.criativos_validados, 0) AS validados,
               CASE WHEN COALESCE(t.criativos_testados, 0) > 0
                   THEN ROUND(COALESCE(v.criativos_validados, 0)::numeric / t.criativos_testados * 100, 1)
                   ELSE 0 END AS taxa_assertividade,
               COALESCE(t.custo_total, 0) AS custo,
               COALESCE(t.faturamento_total, 0) AS faturamento,
               COALESCE(v.faturamento_validados, 0) AS fat_validados,
               COALESCE(t.vendas_total, 0) AS vendas
        FROM produzidos pr
        LEFT JOIN testados t ON pr.copywriter = t.copywriter
        LEFT JOIN validados v ON pr.copywriter = v.copywriter
        ORDER BY COALESCE(t.faturamento_total, 0) DESC
    """)


# === CRIATIVOS ===

@router.get("/criativos/resumo")
def criativos_resumo(request: Request):
    _require_admin(request)
    return _query("""
        SELECT COUNT(*) AS total, COUNT(DISTINCT nicho) AS nichos,
               COUNT(DISTINCT copywriter) FILTER (WHERE copywriter IS NOT NULL) AS copywriters
        FROM impera.dim_criativos_clickup
    """)
