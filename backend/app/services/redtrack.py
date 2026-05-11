"""RedTrack API service — fetch performance data and classify creatives."""
import json
import logging
import os
import re
import time
import urllib.request
import urllib.parse
from datetime import date, timedelta
from app.config import REDTRACK_API_KEY

logger = logging.getLogger(__name__)

_cache = {}
_cache_ttl = 300  # 5 min


def fetch_rt_data(date_from: str, date_to: str) -> list:
    url = "https://api.redtrack.io/report?" + urllib.parse.urlencode({
        "api_key": REDTRACK_API_KEY,
        "group": "campaign,rt_ad",
        "date_from": date_from,
        "date_to": date_to,
        "per": "10000",
    })
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        logger.error(f"RedTrack API error: {e}")
        return []


def get_rt_data_cached() -> list:
    now = time.time()
    if "data" in _cache and now - _cache.get("ts", 0) < _cache_ttl:
        return _cache["data"]
    today = date.today()
    week_ago = today - timedelta(days=7)
    data = fetch_rt_data(week_ago.isoformat(), today.isoformat())
    _cache["data"] = data
    _cache["ts"] = now
    return data


def normalize_rt_ad(rt_ad: str) -> str:
    """Extract creative code from RT ad name. e.g. '[EM][OF02][FB] ADC88 V2 - V123' -> 'ADC88V2-V123'"""
    clean = rt_ad.strip()
    # Remove bracket prefixes [XX][XX][XX]
    clean = re.sub(r'^\s*(\[[^\]]*\]\s*)+', '', clean).strip(' -')
    # Collapse spaces
    clean = re.sub(r'\s+', '', clean)
    return clean.upper()


def classify_creative(cost: float, revenue: float, vendas: int):
    """Classify based on Super Cerebro V5 rules."""
    roas = revenue / cost if cost > 0 else 0
    cpa = cost / vendas if vendas > 0 else float('inf')

    suggestion = None
    if vendas >= 30 and roas >= 1.8:
        suggestion = ("escala", "Pronto pra ESCALA")
    elif vendas >= 10 and cpa <= 180 and roas >= 1.8:
        suggestion = ("validado", "Pronto pra VALIDADO")
    elif vendas >= 3 and cpa <= 180 and roas >= 1.8:
        suggestion = ("pre-escala", "Pronto pra PRE-ESCALA")
    elif cost >= 500 and (vendas == 0 or roas < 1.0):
        suggestion = ("negativo", "Negativo confirmado")
    elif cost >= 200 and roas < 1.0 and vendas <= 2:
        suggestion = ("em-risco", "Em risco")

    return {
        "cost": round(cost, 2),
        "revenue": round(revenue, 2),
        "vendas": vendas,
        "roas": round(roas, 2),
        "cpa": round(cpa, 2) if vendas > 0 else None,
        "suggestion": suggestion[0] if suggestion else None,
        "suggestion_label": suggestion[1] if suggestion else None,
    }


def get_performance_for_task(task_name: str, creative_codes: list) -> dict:
    """Match RT data to individual creatives of a task. Returns {code: perf_dict}."""
    data = get_rt_data_cached()
    if not data:
        return {}

    # Extract the ad group identifier from task name (e.g. "ADC88V2" from "[EM][OF02][FB][ADC88V2][V122-V148]")
    # This is the part before the range
    parts = re.findall(r'\[([^\]]+)\]', task_name)
    ad_group = ""
    for p in parts:
        if re.match(r'(?:AD|C|CE|CY|CC|IMG)\d', p, re.IGNORECASE):
            ad_group = p.upper().replace(" ", "")
            break

    # Build performance map: aggregate by creative code
    perf = {}
    for row in data:
        rt_ad = row.get("rt_ad", "")
        if not rt_ad:
            continue
        norm = normalize_rt_ad(rt_ad)

        # Try matching each creative code
        for code in creative_codes:
            code_upper = code.upper()
            # Match patterns: "ADC88V2-V123" contains "V123", or "AD21" matches "AD21"
            if code_upper in norm or norm.endswith(code_upper):
                # Also verify ad group matches if we have one
                if ad_group and ad_group not in norm and len(ad_group) > 3:
                    continue
                cost = float(row.get("cost", 0))
                rev = float(row.get("revenuetype2", 0)) + float(row.get("revenuetype3", 0))
                vendas = int(row.get("convtype1", 0))
                if code not in perf:
                    perf[code] = {"cost": 0, "revenue": 0, "vendas": 0}
                perf[code]["cost"] += cost
                perf[code]["revenue"] += rev
                perf[code]["vendas"] += vendas

    # Classify each
    result = {}
    for code, p in perf.items():
        result[code] = classify_creative(p["cost"], p["revenue"], p["vendas"])

    return result
