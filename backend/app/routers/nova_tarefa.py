"""Nova Tarefa — criar tarefas de ripagem/direto."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.auth import get_current_user
from app.security import audit_log
from app.config import (
    CLICKUP_LIST_TRAFEGO, GESTOR_CLICKUP_MAP,
    CF_NICHO, CF_FONTE, CF_OFERTA, CF_GESTOR_DROPDOWN,
)
from app.services.clickup import clickup_post, clickup_get

router = APIRouter(prefix="/api/nova-tarefa", tags=["nova-tarefa"])

# Hardcoded options (match ClickUp dropdown values)
NICHOS = [
    {"code": "DA", "label": "DA - Dores Articulares", "cf_id": "e4c250cd-4969-46c9-ade2-df544187c295"},
    {"code": "DB", "label": "DB - Diabetes", "cf_id": "e326248f-a572-4a28-b765-be5d6e5df9aa"},
    {"code": "ED", "label": "ED - Disfuncao", "cf_id": "e4ae63ea-d894-4b95-aa32-7f8f8213cd88"},
    {"code": "EM", "label": "EM - Emagrecimento", "cf_id": "c053d9c8-453d-4d9c-bcbe-cd5d7006849d"},
    {"code": "MM", "label": "MM - Memoria", "cf_id": "71ad290b-e78d-44f3-862b-1b92814c7553"},
    {"code": "NE", "label": "NE - Neuropatia", "cf_id": "44ec8b47-9943-4c65-8bdb-3adc5ce45aa3"},
    {"code": "PT", "label": "PT - Prostata", "cf_id": "c0ccb7cd-d9eb-4081-8589-00e0147fdace"},
    {"code": "ZB", "label": "ZB - Zumbido", "cf_id": "f37178ca-4376-4dc4-8e9e-a2fefb0c6627"},
    {"code": "ME", "label": "ME - Memoria EUA", "cf_id": None},
]

FONTES = [
    {"code": "FB", "label": "FB - Facebook", "cf_id": "ae70abff-7bb6-4a4f-b814-59e6913b5fca"},
    {"code": "GG", "label": "GG - Google", "cf_id": "84497f25-e9f8-483d-85bc-968febf3bd49"},
    {"code": "KW", "label": "KW - Kwai", "cf_id": "6103dfca-2766-42e2-b6d3-6f85082cf1f4"},
    {"code": "YT", "label": "YT - Youtube", "cf_id": "e3287541-071d-466c-98ee-8ac2b31f7a23"},
    {"code": "TT", "label": "TT - TikTok", "cf_id": "d471bbf3-016e-49df-8b53-85673089a585"},
    {"code": "TB", "label": "TB - Taboola", "cf_id": "a6384df0-e115-4017-baeb-2ae846b32722"},
    {"code": "VT", "label": "VT - Vturb", "cf_id": "37699059-0c04-4645-ab08-684f64ae7e8d"},
]

OFERTAS = [
    {"code": "OF01", "label": "OF01"}, {"code": "OF02", "label": "OF02"},
    {"code": "OF03", "label": "OF03"}, {"code": "OF022", "label": "OF022"},
    {"code": "C01", "label": "C01"}, {"code": "C02", "label": "C02"},
]

GESTORES = [
    {"key": "lucas", "nome": "Lucas Cavalcanti"},
    {"key": "ludson", "nome": "Ludson Chaves"},
    {"key": "douglas", "nome": "Douglas Oliveira"},
    {"key": "gustavo", "nome": "Gustavo Lisner"},
    {"key": "gabriel", "nome": "Gabriel Fraza"},
]

GESTOR_DROPDOWN_OPTIONS = {
    "lucas": "261845b8-cc2e-45b5-beb7-46d6e6e94760",
    "ludson": "5aea1aea-e3ad-454d-8fbd-774dbb740d2c",
    "douglas": "377c1e98-e147-4880-883b-9c20db3494c1",
    "gustavo": "0068cbe7-a170-4e79-b140-6903ad3b43f3",
    "gabriel": "5e557310-28d0-4ba0-b71c-e434f5679e3e",
}


@router.get("/options")
def get_options(request: Request):
    user = get_current_user(request)
    return {
        "nichos": [{"code": n["code"], "label": n["label"]} for n in NICHOS],
        "regioes": [{"code": "BR", "label": "Brasil"}, {"code": "EUA", "label": "EUA"}],
        "fontes": [{"code": f["code"], "label": f["label"]} for f in FONTES],
        "ofertas": OFERTAS,
        "gestores": GESTORES,
    }


class CreateTaskRequest(BaseModel):
    nicho: str
    regiao: str
    oferta: str
    fonte: str
    creative_name: str
    material_link: str
    gestor_key: str


@router.post("/create")
def create_task(request: Request, body: CreateTaskRequest):
    user = get_current_user(request)

    # Block visitante from creating tasks
    if user["role"] == "visitante":
        raise HTTPException(status_code=403, detail="Visitantes nao podem criar tarefas")

    # Build task name
    regiao_part = f"[{body.regiao}]" if body.regiao == "EUA" else "[BR]"
    name = f"[{body.nicho}]{regiao_part}[{body.oferta}][{body.fonte}][{body.creative_name}]"

    # Resolve custom field values
    nicho_cf = next((n["cf_id"] for n in NICHOS if n["code"] == body.nicho), None)
    fonte_cf = next((f["cf_id"] for f in FONTES if f["code"] == body.fonte), None)
    gestor_cf = GESTOR_DROPDOWN_OPTIONS.get(body.gestor_key.lower())
    gestor_cu_id = GESTOR_CLICKUP_MAP.get(body.gestor_key.lower())

    custom_fields = []
    if nicho_cf:
        custom_fields.append({"id": CF_NICHO, "value": nicho_cf})
    if fonte_cf:
        custom_fields.append({"id": CF_FONTE, "value": fonte_cf})
    if gestor_cf:
        custom_fields.append({"id": CF_GESTOR_DROPDOWN, "value": gestor_cf})

    description = f"Tarefa criada via Gestao de Testes\n\nLink do material: {body.material_link}" if body.material_link else ""

    task_data = {
        "name": name,
        "status": "aguardando teste",
        "description": description,
        "custom_fields": custom_fields,
    }
    if gestor_cu_id:
        task_data["assignees"] = [gestor_cu_id]

    try:
        result = clickup_post(f"/list/{CLICKUP_LIST_TRAFEGO}/task", task_data)
        ip = request.client.host if request.client else "unknown"
        audit_log(user["sub"], "create_task", f"task created: {name}", ip)
        return {
            "status": "ok",
            "task_id": result.get("id"),
            "task_name": name,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
