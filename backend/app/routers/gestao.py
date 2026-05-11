"""Gestao de Testes — endpoints para gerenciar criativos ativos."""
import re
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.config import (
    CLICKUP_LIST_TRAFEGO, GESTOR_CLICKUP_MAP,
    CF_NICHO, CF_COPYWRITER, CF_EDITOR, CF_FONTE, CF_OFERTA, CF_MES, CF_GESTOR_DROPDOWN,
)
from app.services.clickup import (
    get_list_tasks, get_task_detail, get_cf_value,
    clickup_post, clickup_get,
)
from app.services.redtrack import get_performance_for_task

router = APIRouter(prefix="/api/gestao", tags=["gestao"])

ACTIVE_STATUSES = [
    "em teste", "pré-escala", "validado", "escala",
    "em risco", "negativo", "pausado",
]


def parse_creative_range(task_name: str) -> list:
    """Parse [V122-V148] or [AD21-AD25] into individual codes.
    If no range found, returns ["_SINGLE"] to indicate the task itself is one creative."""
    results = []
    # Match ranges like [V122-V148], [V1-V20], [AD21-AD25], [AD21-25]
    for m in re.finditer(r'\[([A-Z]+)(\d+)-\1?(\d+)\]', task_name):
        prefix = m.group(1)
        start = int(m.group(2))
        end = int(m.group(3))
        for i in range(start, end + 1):
            results.append(f"{prefix}{i}")
    if results:
        return results

    # Try implicit prefix: [V122-148]
    for m in re.finditer(r'\[([A-Z]+)(\d+)-(\d+)\]', task_name):
        prefix = m.group(1)
        start = int(m.group(2))
        end = int(m.group(3))
        if end > start:
            for i in range(start, end + 1):
                results.append(f"{prefix}{i}")
    if results:
        return results

    # Single creative in brackets: [V123] or [AD21]
    singles = re.findall(r'\[(V\d+|AD\d+)\](?!\[)', task_name)
    if singles:
        return singles

    # No range found — the task itself is one creative (e.g. "[EM][OF02][FB] AD644")
    # Return special marker so the UI can show the task as movable
    return ["_SINGLE"]


def build_subtask_name(parent_name: str, creative_code: str) -> str:
    """Replace the range bracket with a single creative code.
    If _SINGLE, return the parent name as-is (task moves directly, no subtask)."""
    if creative_code == "_SINGLE":
        return parent_name
    # Replace ranges: [V199-V224], [V199-224], [AD21-AD25], [AD21-25]
    # The prefix may or may not repeat before the second number
    result = re.sub(r'\[[A-Z]+\d+-[A-Z]*\d+\]', f'[{creative_code}]', parent_name, count=1)
    # Remove batch version marker [V1] or [V1-V2] at end (only low numbers = batch marker, not creative)
    result = re.sub(r'\[V[12](?:-V?[12])?\]$', '', result)
    return result


def _task_summary(t):
    name = t.get("name", "")
    nicho = get_cf_value(t, CF_NICHO) or ""
    date_created = int(t.get("date_created", "0"))
    # has_alert: true if task has been in "em teste" for >7 days
    days_since_created = (time.time() * 1000 - date_created) / (1000 * 60 * 60 * 24) if date_created else 0
    status = t["status"]["status"]
    has_alert = status == "em teste" and days_since_created > 7
    return {
        "id": t["id"],
        "name": name,
        "nicho": nicho.split(" - ")[0].strip() if nicho else "",
        "oferta": get_cf_value(t, CF_OFERTA),
        "fonte": get_cf_value(t, CF_FONTE),
        "copywriter": get_cf_value(t, CF_COPYWRITER),
        "editor": get_cf_value(t, CF_EDITOR),
        "status": status,
        "creative_count": len(parse_creative_range(name)),
        "date_created": date_created,
        "has_alert": has_alert,
    }


@router.get("/tasks")
def list_tasks(gestor: str = Query(...)):
    """Get all active tasks for a gestor, grouped by status."""
    gestor_cu_id = GESTOR_CLICKUP_MAP.get(gestor.lower())
    if not gestor_cu_id:
        raise HTTPException(status_code=400, detail=f"Gestor '{gestor}' nao encontrado")

    all_tasks = get_list_tasks(CLICKUP_LIST_TRAFEGO, statuses=ACTIVE_STATUSES)

    # Filter by assignee and get subtask counts
    tasks_by_status = {}
    subtask_counts = {}

    for t in all_tasks:
        if t.get("parent"):
            # Count subtasks per parent
            pid = t["parent"]
            subtask_counts[pid] = subtask_counts.get(pid, 0) + 1
            continue

        # Check if gestor is assigned
        assignee_ids = [a.get("id") for a in t.get("assignees", [])]
        if gestor_cu_id not in assignee_ids:
            continue

        status = t["status"]["status"]
        if status not in tasks_by_status:
            tasks_by_status[status] = []

        summary = _task_summary(t)
        tasks_by_status[status].append(summary)

    # Add subtask counts and sort
    groups = []
    for status in ACTIVE_STATUSES:
        tasks = tasks_by_status.get(status, [])
        for task in tasks:
            task["moved_count"] = subtask_counts.get(task["id"], 0)
        tasks.sort(key=lambda x: x["date_created"])
        if tasks:
            groups.append({"status": status, "count": len(tasks), "tasks": tasks})

    return {"groups": groups}


@router.get("/tasks/{task_id}/creatives")
def task_creatives(task_id: str, gestor: str = Query(...)):
    """Expand a task into individual creatives with performance data."""
    try:
        task = get_task_detail(task_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    name = task.get("name", "")
    creatives = parse_creative_range(name)

    # Get existing subtasks — ignore legacy statuses (aguardando teste, em teste)
    LEGACY_STATUSES = {"aguardando teste", "em teste"}
    existing_subs = {}
    for st in task.get("subtasks", []):
        sub_name = st.get("name", "")
        sub_status = st.get("status", {}).get("status", "")
        if sub_status in LEGACY_STATUSES:
            continue  # Skip legacy subtasks from old expandir_subtarefas system
        # Try to match subtask to a creative code
        for code in creatives:
            if f"[{code}]" in sub_name or sub_name.endswith(code):
                existing_subs[code] = {"id": st["id"], "status": sub_status}
                break

    # Get RT performance data
    perf_data = {}
    try:
        perf_data = get_performance_for_task(name, creatives)
    except Exception:
        pass

    # Build creative list
    creative_list = []
    for code in creatives:
        existing = existing_subs.get(code)
        perf = perf_data.get(code)
        creative_list.append({
            "code": code,
            "already_moved": existing is not None,
            "existing_subtask_id": existing["id"] if existing else None,
            "existing_status": existing["status"] if existing else None,
            "performance": perf,
        })

    nicho = get_cf_value(task, CF_NICHO) or ""
    return {
        "task": {
            "id": task["id"],
            "name": name,
            "status": task["status"]["status"],
            "nicho": nicho.split(" - ")[0].strip(),
            "oferta": get_cf_value(task, CF_OFERTA),
            "fonte": get_cf_value(task, CF_FONTE),
            "copywriter": get_cf_value(task, CF_COPYWRITER),
            "editor": get_cf_value(task, CF_EDITOR),
        },
        "creatives": creative_list,
        "total": len(creatives),
        "moved": len(existing_subs),
    }


class MoveCreativeRequest(BaseModel):
    creative_code: str
    destination_status: str
    gestor_nome: str


@router.post("/tasks/{task_id}/move-creative")
def move_creative(task_id: str, body: MoveCreativeRequest):
    """Move a creative: if _SINGLE, move the task itself. Otherwise create subtask."""
    from app.services.clickup import update_task_status

    try:
        task = get_task_detail(task_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

    parent_name = task.get("name", "")
    creatives = parse_creative_range(parent_name)

    if body.creative_code not in creatives:
        raise HTTPException(status_code=400, detail=f"Criativo '{body.creative_code}' nao faz parte do range")

    # SINGLE creative — move the task itself (no subtask needed)
    if body.creative_code == "_SINGLE":
        try:
            update_task_status(task_id, body.destination_status)
            return {
                "status": "ok",
                "subtask_id": None,
                "creative_code": "_SINGLE",
                "new_status": body.destination_status,
                "subtask_name": parent_name,
                "action": "moved_task",
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # Check if already moved
    for st in task.get("subtasks", []):
        if f"[{body.creative_code}]" in st.get("name", ""):
            raise HTTPException(status_code=409, detail=f"Criativo '{body.creative_code}' ja foi movido")

    # Build subtask name
    sub_name = build_subtask_name(parent_name, body.creative_code)

    # Copy custom fields from parent
    fields_to_copy = [CF_NICHO, CF_COPYWRITER, CF_EDITOR, CF_FONTE, CF_OFERTA, CF_MES, CF_GESTOR_DROPDOWN]
    custom_fields = []
    for cf in task.get("custom_fields", []):
        if cf["id"] in fields_to_copy and cf.get("value") is not None:
            if cf.get("type") == "drop_down":
                opts = cf.get("type_config", {}).get("options", [])
                val = cf["value"]
                if isinstance(val, int) and val < len(opts):
                    custom_fields.append({"id": cf["id"], "value": opts[val]["id"]})
                else:
                    custom_fields.append({"id": cf["id"], "value": val})
            else:
                custom_fields.append({"id": cf["id"], "value": cf["value"]})

    # Get gestor ClickUp ID
    gestor_key = body.gestor_nome.split()[0].lower() if body.gestor_nome else ""
    gestor_cu_id = GESTOR_CLICKUP_MAP.get(gestor_key)

    # Create subtask
    sub_data = {
        "name": sub_name,
        "status": body.destination_status,
        "parent": task_id,
        "custom_fields": custom_fields,
    }
    if gestor_cu_id:
        sub_data["assignees"] = [gestor_cu_id]

    try:
        result = clickup_post(f"/list/{CLICKUP_LIST_TRAFEGO}/task", sub_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Check if ALL creatives have been moved — if so, move parent to "testes concluídos"
    parent_action = None
    try:
        from app.services.clickup import clickup_post as _post
        updated_task = get_task_detail(task_id)
        moved_subs = []
        for st in updated_task.get("subtasks", []):
            st_status = st.get("status", {}).get("status", "")
            if st_status not in ("aguardando teste", "em teste"):
                moved_subs.append({"name": st.get("name", ""), "status": st_status})

        if len(moved_subs) >= len(creatives):
            # All creatives moved — build test summary and move parent
            date_created = int(updated_task.get("date_created", "0"))
            now_ms = int(time.time() * 1000)
            days = round((now_ms - date_created) / (1000 * 60 * 60 * 24)) if date_created else 0
            from datetime import datetime
            start_date = datetime.fromtimestamp(date_created / 1000).strftime("%d/%m/%Y") if date_created else "?"
            end_date = datetime.now().strftime("%d/%m/%Y")

            # Count results
            positivos = sum(1 for s in moved_subs if s["status"] in ("pré-escala", "validado", "escala"))
            total = len(moved_subs)

            # Build summary comment
            lines = [
                f"══ TESTE CONCLUÍDO ══",
                f"Início: {start_date}",
                f"Conclusão: {end_date}",
                f"Duração: {days} dias",
                f"",
                f"Resultado ({positivos}/{total} positivos — {round(positivos/total*100)}%):",
            ]
            for s in moved_subs:
                lines.append(f"  {s['name'].split(']')[-1] if ']' in s['name'] else s['name']} → {s['status']}")

            comment_text = "\n".join(lines)

            # Move parent to "testes concluídos"
            update_task_status(task_id, "testes concluídos")

            # Post summary as comment
            try:
                _post(f"/task/{task_id}/comment", {"comment_text": comment_text})
            except Exception:
                pass

            parent_action = "teste_concluido"
    except Exception:
        pass  # Non-critical — parent stays in "em teste" if this fails

    return {
        "status": "ok",
        "subtask_id": result.get("id"),
        "creative_code": body.creative_code,
        "new_status": body.destination_status,
        "subtask_name": sub_name,
        "action": "created_subtask",
        "parent_action": parent_action,
    }
