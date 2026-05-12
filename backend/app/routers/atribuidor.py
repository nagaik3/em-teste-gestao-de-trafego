"""Atribuidor de Testes — endpoints."""
import time
from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from app.auth import get_current_user
from app.security import audit_log
from app.config import (
    CLICKUP_LIST_TRAFEGO, GESTOR_CLICKUP_MAP, COPYWRITER_USER_MAP,
    CF_NICHO, CF_COPYWRITER, CF_EDITOR, CF_FONTE, CF_OFERTA, CF_MES,
)
from app.services.clickup import (
    get_list_tasks, get_task_detail, get_cf_value,
    update_task_status, add_task_assignee, clickup_post,
)

router = APIRouter(prefix="/api/atribuidor", tags=["atribuidor"])
NICHOS = ["DA", "DB", "ED", "EM", "ME", "MM", "NE", "PT", "ZB"]


def _detect_mercado(name):
    return "EUA" if "[EUA]" in name.upper() else "BR"


def _detect_nicho(name):
    for n in NICHOS:
        if f"[{n}]" in name:
            return n
    return ""


def _task_summary(t):
    name = t.get("name", "")
    date_created = int(t.get("date_created", "0"))
    days_waiting = int((time.time() * 1000 - date_created) / (1000 * 60 * 60 * 24)) if date_created else 0
    return {
        "id": t["id"], "name": name,
        "nicho": get_cf_value(t, CF_NICHO) or _detect_nicho(name),
        "regiao": _detect_mercado(name),
        "oferta": get_cf_value(t, CF_OFERTA),
        "fonte": get_cf_value(t, CF_FONTE),
        "copywriter": get_cf_value(t, CF_COPYWRITER),
        "editor": get_cf_value(t, CF_EDITOR),
        "mes": get_cf_value(t, CF_MES),
        "date_created": date_created,
        "days_waiting": days_waiting,
        "assignees": [{"id": a.get("id"), "username": a.get("username")} for a in t.get("assignees", [])],
    }


def _task_detail(t):
    s = _task_summary(t)
    s["description"] = t.get("description") or t.get("text_content") or ""
    s["status"] = t.get("status", {}).get("status", "")
    s["checklists"] = []
    for cl in t.get("checklists", []):
        items = [{"name": i.get("name", ""), "resolved": i.get("resolved", False)} for i in cl.get("items", [])]
        s["checklists"].append({"name": cl.get("name", ""), "items": items})
    return s


@router.get("/counts")
def counts(request: Request):
    user = get_current_user(request)
    tasks = get_list_tasks(CLICKUP_LIST_TRAFEGO, statuses=["aguardando teste"])
    c = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    fonte_counts = defaultdict(int)
    for t in tasks:
        if t.get("parent"):
            continue
        name = t.get("name", "")
        nicho = (get_cf_value(t, CF_NICHO) or _detect_nicho(name)).split(" - ")[0].strip()
        regiao = _detect_mercado(name)
        raw_fonte = get_cf_value(t, CF_FONTE)
        fonte_name = raw_fonte.split(" - ")[0].strip() if raw_fonte else "Sem fonte"
        if nicho:
            c[fonte_name][nicho][regiao] += 1
            fonte_counts[fonte_name] += 1
    detail_counts = []
    for fonte in c:
        for n in NICHOS:
            for r in ["BR", "EUA"]:
                val = c[fonte].get(n, {}).get(r, 0)
                if val > 0:
                    detail_counts.append({"fonte": fonte, "nicho": n, "regiao": r, "count": val})
    fonte_list = [{"fonte": f, "count": fonte_counts[f]} for f in sorted(fonte_counts, key=lambda x: fonte_counts[x], reverse=True)]
    return {"counts": detail_counts, "fonte_counts": fonte_list}


@router.get("/tasks")
def list_tasks(request: Request, nicho: str = Query(...), regiao: str = Query("BR"), fonte: Optional[str] = Query(None)):
    user = get_current_user(request)
    tasks = get_list_tasks(CLICKUP_LIST_TRAFEGO, statuses=["aguardando teste"])
    filtered = []
    for t in tasks:
        if t.get("parent"):
            continue
        name = t.get("name", "")
        t_nicho = (get_cf_value(t, CF_NICHO) or _detect_nicho(name)).split(" - ")[0].strip()
        if t_nicho == nicho.upper() and _detect_mercado(name) == regiao.upper():
            if fonte:
                raw_fonte = get_cf_value(t, CF_FONTE)
                t_fonte = raw_fonte.split(" - ")[0].strip() if raw_fonte else "Sem fonte"
                if t_fonte != fonte:
                    continue
            filtered.append(_task_summary(t))
    filtered.sort(key=lambda x: x["date_created"])
    return filtered


@router.get("/tasks/{task_id}")
def task_detail(request: Request, task_id: str):
    user = get_current_user(request)
    try:
        return _task_detail(get_task_detail(task_id))
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


class ClaimRequest(BaseModel):
    gestor_nome: str


@router.post("/tasks/{task_id}/claim")
def claim_task(request: Request, task_id: str, body: ClaimRequest):
    user = get_current_user(request)

    # Block visitante from writing
    if user["role"] == "visitante":
        raise HTTPException(status_code=403, detail="Visitantes nao podem iniciar testes")

    # For gestor, force gestor_nome from JWT
    if user["role"] == "gestor":
        gestor_name = user["nome"]
    else:
        gestor_name = body.gestor_nome

    gestor_key = gestor_name.split()[0].lower() if gestor_name else ""
    gestor_cu_id = GESTOR_CLICKUP_MAP.get(gestor_key)

    try:
        update_task_status(task_id, "em teste")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    warnings = []

    if gestor_cu_id:
        try:
            add_task_assignee(task_id, gestor_cu_id)
        except Exception as e:
            warnings.append(f"Falha ao adicionar assignee: {e}")

    try:
        task = get_task_detail(task_id)
        copywriter = get_cf_value(task, CF_COPYWRITER) or ""
        cu_id = COPYWRITER_USER_MAP.get(copywriter.upper().strip())
        comment = f"Tarefa entrou em teste!\nGestor: {gestor_name}\nCopywriter: {copywriter or 'N/A'} — acompanhe em 3 dias."
        data = {"comment_text": comment, "notify_all": False}
        if cu_id:
            data["assignee"] = cu_id
        else:
            data["notify_all"] = True
        clickup_post(f"/task/{task_id}/comment", data)
    except Exception as e:
        warnings.append(f"Falha ao postar comentario: {e}")

    ip = request.client.host if request.client else "unknown"
    audit_log(user["sub"], "claim_task", f"task {task_id} claimed", ip)

    return {"status": "ok", "task_id": task_id, "new_status": "em teste", "gestor": gestor_name, "warnings": warnings}
