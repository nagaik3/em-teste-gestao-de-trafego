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


ALLOWED_ROLES = {"admin", "ceo", "lider_edicao"}


def _require_admin(request: Request):
    user = get_current_user(request)
    if user.get("role") not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Acesso restrito")
    return user


# === PERFORMANCE FINANCEIRA ===

@router.get("/performance/resumo")
def performance_resumo(request: Request):
    """Fonte: public.fato_performance (ETL diário via etl_dashboard.py)."""
    _require_admin(request)

    # MTD (Month to Date)
    mtd = _query("""
        SELECT COUNT(*) AS total_ads,
               COALESCE(SUM(f.cost), 0) AS custo_total,
               COALESCE(SUM(f.revenue_front), 0) AS fat_total,
               COALESCE(SUM(f.vendas_total), 0) AS vendas_total,
               ROUND(SUM(f.revenue_front) / NULLIF(SUM(f.cost), 0), 2) AS roas_geral,
               ROUND((SUM(f.revenue_front) * 0.74) - (SUM(f.cost) * 1.12), 2) AS mc_br_total,
               COUNT(*) FILTER (WHERE f.nicho_id IS NOT NULL) AS ads_com_match,
               COUNT(*) FILTER (WHERE f.nicho_id IS NULL) AS ads_sem_match
        FROM public.fato_performance f
        WHERE f.data >= DATE_TRUNC('month', CURRENT_DATE)::date
    """)
    result = mtd[0] if mtd else {}

    # Hoje
    hoje = _query("""
        SELECT COALESCE(SUM(cost), 0) AS custo,
               COALESCE(SUM(revenue_front), 0) AS fat,
               COALESCE(SUM(vendas_total), 0) AS vendas,
               ROUND(SUM(revenue_front) / NULLIF(SUM(cost), 0), 2) AS roas
        FROM public.fato_performance
        WHERE data = CURRENT_DATE
    """)
    h = hoje[0] if hoje else {}

    # Ontem
    ontem = _query("""
        SELECT COALESCE(SUM(cost), 0) AS custo,
               COALESCE(SUM(revenue_front), 0) AS fat,
               COALESCE(SUM(vendas_total), 0) AS vendas,
               ROUND(SUM(revenue_front) / NULLIF(SUM(cost), 0), 2) AS roas
        FROM public.fato_performance
        WHERE data = CURRENT_DATE - 1
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
    """Fonte: public.fato_performance + dim_gestor (ETL diário)."""
    _require_admin(request)
    return _query("""
        SELECT g.nome AS gestor, COUNT(*) AS campanhas,
               ROUND(SUM(f.cost)::numeric, 0) AS custo,
               ROUND(SUM(f.revenue_front)::numeric, 0) AS faturamento,
               SUM(f.vendas_total) AS vendas,
               ROUND(SUM(f.revenue_front) / NULLIF(SUM(f.cost), 0), 2) AS roas,
               ROUND((SUM(f.revenue_front) * 0.74) - (SUM(f.cost) * 1.12), 2) AS mc_br
        FROM public.fato_performance f
        LEFT JOIN public.dim_gestor g ON f.gestor_id = g.gestor_id
        WHERE f.data >= DATE_TRUNC('month', CURRENT_DATE)::date
        GROUP BY g.nome ORDER BY SUM(f.revenue_front) DESC
    """)


@router.get("/performance/classificacao")
def performance_classificacao(request: Request):
    """Fonte: public.fato_performance (ETL diário) com classificação V5 inline."""
    _require_admin(request)
    return _query("""
        SELECT status_escala, COUNT(*) AS qtd,
               ROUND(SUM(custo)::numeric, 0) AS custo,
               ROUND(SUM(fat)::numeric, 0) AS faturamento,
               SUM(vendas) AS vendas,
               ROUND(SUM(fat) / NULLIF(SUM(custo), 0), 2) AS roas
        FROM (
            SELECT cost AS custo, revenue_front AS fat, vendas_total AS vendas,
                CASE
                    WHEN vendas_total >= 30 AND ROUND(revenue_front / NULLIF(cost, 0), 2) >= 1.8 THEN 'Escala'
                    WHEN vendas_total >= 10 AND ROUND(revenue_front / NULLIF(cost, 0), 2) >= 1.8 THEN 'Validado/Tracao'
                    WHEN vendas_total >= 3 AND vendas_total <= 9
                         AND ROUND(cost / NULLIF(vendas_total, 0)::numeric, 2) <= 180
                         AND ROUND(revenue_front / NULLIF(cost, 0), 2) >= 1.8 THEN 'Pre-validado'
                    WHEN cost >= 500 AND ROUND(revenue_front / NULLIF(cost, 0), 2) < 1.0 AND vendas_total = 0 THEN 'Negativo'
                    WHEN cost >= 200 AND ROUND(revenue_front / NULLIF(cost, 0), 2) < 1.0 AND vendas_total <= 2 THEN 'Em Risco'
                    ELSE 'Em Teste'
                END AS status_escala
            FROM public.fato_performance
            WHERE data >= DATE_TRUNC('month', CURRENT_DATE)::date
        ) sub
        GROUP BY status_escala ORDER BY SUM(fat) DESC
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
          AND (d.nome_nomenclatura IS NULL OR d.nome_nomenclatura NOT LIKE '%%[LEGADO]%%')
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
            COUNT(*) FILTER (WHERE data_saida >= DATE_TRUNC('month', CURRENT_DATE)::date) AS mes
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
    """Fonte: public.fato_performance (ETL diário) + impera.view_dim_ativa."""
    _require_admin(request)
    return _query("""
        WITH perf_with_ref AS (
            SELECT cost, revenue_front, vendas_total,
                CASE
                    WHEN regexp_replace(upper(adgroup_name), '\\[.*?\\]', '', 'g') ~ '^\\s*AD\\d+'
                        THEN (regexp_match(regexp_replace(regexp_replace(upper(adgroup_name), '\\[.*?\\]', '', 'g'), '\\s+', '', 'g'), '^(AD\\d+)'))[1]
                    WHEN regexp_replace(upper(adgroup_name), '\\[.*?\\]', '', 'g') ~ '^\\s*ADC\\d+'
                        THEN 'C' || (regexp_match(regexp_replace(regexp_replace(upper(adgroup_name), '\\[.*?\\]', '', 'g'), '\\s+', '', 'g'), '^ADC(\\d+)'))[1]
                    WHEN regexp_replace(upper(adgroup_name), '\\[.*?\\]', '', 'g') ~ '^\\s*C[EYC]\\d+'
                        THEN (regexp_match(regexp_replace(regexp_replace(upper(adgroup_name), '\\[.*?\\]', '', 'g'), '\\s+', '', 'g'), '^(C[EYC]\\d+)'))[1]
                    WHEN regexp_replace(upper(adgroup_name), '\\[.*?\\]', '', 'g') ~ '^\\s*C\\d+'
                        THEN (regexp_match(regexp_replace(regexp_replace(upper(adgroup_name), '\\[.*?\\]', '', 'g'), '\\s+', '', 'g'), '^(C\\d+)'))[1]
                    ELSE NULL
                END AS base_ref
            FROM public.fato_performance
            WHERE data >= CURRENT_DATE - INTERVAL '30 days'
        ),
        produzidos AS (
            SELECT copywriter, COUNT(DISTINCT base_ref) AS total_criativos
            FROM impera.view_dim_ativa WHERE copywriter IS NOT NULL GROUP BY copywriter
        ),
        validados AS (
            SELECT d.copywriter, COUNT(DISTINCT p.base_ref) AS criativos_validados,
                   ROUND(SUM(p.revenue_front)::numeric, 0) AS faturamento_validados
            FROM perf_with_ref p
            JOIN impera.view_dim_ativa d ON p.base_ref = d.base_ref
            WHERE d.copywriter IS NOT NULL AND p.base_ref IS NOT NULL
              AND p.vendas_total >= 10
              AND ROUND(p.revenue_front / NULLIF(p.cost, 0), 2) >= 1.8
            GROUP BY d.copywriter
        ),
        testados AS (
            SELECT d.copywriter, COUNT(DISTINCT p.base_ref) AS criativos_testados,
                   ROUND(SUM(p.cost)::numeric, 0) AS custo_total,
                   ROUND(SUM(p.revenue_front)::numeric, 0) AS faturamento_total,
                   SUM(p.vendas_total) AS vendas_total
            FROM perf_with_ref p
            JOIN impera.view_dim_ativa d ON p.base_ref = d.base_ref
            WHERE d.copywriter IS NOT NULL AND p.base_ref IS NOT NULL
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
