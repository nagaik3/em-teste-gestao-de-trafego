import os

JWT_SECRET = os.environ.get("JWT_SECRET", "impera-atribuidor-secret-2026")
REDTRACK_API_KEY = os.environ.get("REDTRACK_API_KEY", "")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_EXPIRE_MINUTES = 60 * 24  # 24h

CLICKUP_API_TOKEN = os.environ.get("CLICKUP_API_TOKEN", "")
CLICKUP_LIST_TRAFEGO = "901324476398"

# Gestor nome → ClickUp user ID
GESTOR_CLICKUP_MAP = {
    "lucas": 87343090,
    "ludson": 82074473,
    "douglas": 82118000,
    "gustavo": 82168803,
    "gabriel": 105940694,
}

# Copywriter dropdown → ClickUp user ID (para @mention)
COPYWRITER_USER_MAP = {
    "YAN": 81970243,
    "REAPER": 18922946,
    "CRISPIM": 118015162,
    "ANA": 118024166,
    "ELIAS": 84627549,
    "CAROL": 118051219,
}

# Custom Field IDs
CF_NICHO = "f61bfe77-933f-4637-828a-c9d8ef400d60"
CF_COPYWRITER = "eeb64866-df57-4dbf-8338-5d4fb58837aa"
CF_EDITOR = "6002b1b9-e8c5-49ad-9e3d-3d8c314a1c91"
CF_FONTE = "796e4880-13f0-4d30-9d3b-1ee72c6df14c"
CF_OFERTA = "1149425c-f3c9-478e-af23-37677d5f7eb3"
CF_MES = "deaa7741-15a9-4368-a88c-7ed4603cff1a"
CF_GESTOR_DROPDOWN = "b7cec33c-bba0-4565-8ece-23cd95fab66e"

# Users (hardcoded — time pequeno)
USERS = {
    "iago@impera.com": {"password": "admin123", "nome": "Iago Almeida", "role": "admin"},
    "lucas@impera.com": {"password": "impera2026", "nome": "Lucas Cavalcanti", "role": "gestor"},
    "ludson@impera.com": {"password": "impera2026", "nome": "Ludson Chaves", "role": "gestor"},
    "douglas@impera.com": {"password": "impera2026", "nome": "Douglas Oliveira", "role": "gestor"},
    "gustavo@impera.com": {"password": "impera2026", "nome": "Gustavo Lisner", "role": "gestor"},
}
