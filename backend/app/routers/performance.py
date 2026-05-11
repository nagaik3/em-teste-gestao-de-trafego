"""Performance — summary alerts from RedTrack."""
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Query, Request
from app.auth import get_current_user
from app.config import CLICKUP_LIST_TRAFEGO, GESTOR_CLICKUP_MAP
from app.services.clickup import get_list_tasks, get_cf_value
from app.services.redtrack import get_performance_for_task
from app.routers.gestao import parse_creative_range, ACTIVE_STATUSES

router = APIRouter(prefix="/api/performance", tags=["performance"])


@router.get("/summary")
def performance_summary(request: Request, gestor: str = Query(...)):
    user = get_current_user(request)

    # Gestor role: force their own gestor_key
    if user["role"] == "gestor":
        gestor = user.get("gestor_key") or gestor

    gestor_cu_id = GESTOR_CLICKUP_MAP.get(gestor.lower())
    if not gestor_cu_id:
        raise HTTPException(status_code=400, detail="Gestor nao encontrado")

    tasks = get_list_tasks(CLICKUP_LIST_TRAFEGO, statuses=ACTIVE_STATUSES)
    alerts = defaultdict(int)

    for t in tasks:
        if t.get("parent"):
            continue
        assignee_ids = [a.get("id") for a in t.get("assignees", [])]
        if gestor_cu_id not in assignee_ids:
            continue

        name = t.get("name", "")
        creatives = parse_creative_range(name)
        if not creatives:
            continue

        try:
            perf = get_performance_for_task(name, creatives)
            for code, data in perf.items():
                if data.get("suggestion"):
                    alerts[data["suggestion"]] += 1
        except Exception:
            continue

    return {"alerts": dict(alerts)}
