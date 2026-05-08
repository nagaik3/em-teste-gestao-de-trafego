"""ClickUp API service."""
import time
import urllib.request
import urllib.parse
import json
from typing import Optional, List
from app.config import CLICKUP_API_TOKEN

BASE = "https://api.clickup.com/api/v2"


def _headers():
    return {"Authorization": CLICKUP_API_TOKEN, "Content-Type": "application/json"}


def _request(method, endpoint, data=None):
    url = f"{BASE}{endpoint}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=_headers(), method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
        return json.loads(raw) if raw else {}


def clickup_get(endpoint):
    return _request("GET", endpoint)


def clickup_put(endpoint, data):
    return _request("PUT", endpoint, data)


def clickup_post(endpoint, data):
    return _request("POST", endpoint, data)


def get_list_tasks(list_id, statuses=None):
    all_tasks = []
    page = 0
    while True:
        params = {"page": str(page), "include_closed": "false", "subtasks": "false"}
        if statuses:
            status_params = "&".join(f"statuses[]={urllib.parse.quote(s)}" for s in statuses)
            qs = "&".join(f"{k}={v}" for k, v in params.items())
            endpoint = f"/list/{list_id}/task?{qs}&{status_params}"
        else:
            qs = "&".join(f"{k}={v}" for k, v in params.items())
            endpoint = f"/list/{list_id}/task?{qs}"
        resp = clickup_get(endpoint)
        tasks = resp.get("tasks", [])
        if not tasks:
            break
        all_tasks.extend(tasks)
        page += 1
        time.sleep(0.3)
    return all_tasks


def get_task_detail(task_id):
    return clickup_get(f"/task/{task_id}?include_subtasks=true")


def update_task_status(task_id, status):
    return clickup_put(f"/task/{task_id}", {"status": status})


def add_task_assignee(task_id, user_id):
    return clickup_put(f"/task/{task_id}", {"assignees": {"add": [user_id]}})


def get_cf_value(task, field_id):
    for cf in task.get("custom_fields", []):
        if cf["id"] != field_id:
            continue
        val = cf.get("value")
        if val is None:
            return None
        if cf.get("type") == "drop_down" and "type_config" in cf:
            for opt in cf["type_config"].get("options", []):
                if opt.get("orderindex") == val or opt.get("id") == str(val):
                    return opt.get("name")
            if isinstance(val, int) and val < len(cf["type_config"].get("options", [])):
                return cf["type_config"]["options"][val].get("name")
        return str(val)
    return None
