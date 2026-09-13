"""Generate secret-free Postman and Insomnia exports from the route contract."""
import json
import yaml
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "{{base_url}}/api/v1"

routes = [
    ("GET", "/", "public", None), ("GET", "/health", "public", None),
    ("GET", "/health/live", "public", None), ("GET", "/health/ready", "public", None),
    ("POST", "/auth/login", "public", {"email": "{{email}}", "password": "{{password}}"}),
    ("POST", "/auth/register", "admin", {"email": "new-user@example.invalid", "password": "{{new_password}}", "name": "Collection User", "role": "RECEPCIONISTA"}),
]
for resource, singular in (("clientes", "cliente"), ("veiculos", "veiculo"), ("servicos", "servico")):
    create_role = "admin" if resource == "servicos" else "receptionist"
    routes += [("POST", f"/{resource}", create_role, {}), ("GET", f"/{resource}", "any", None),
               ("GET", f"/{resource}/{{{{{singular}_id}}}}", "any", None),
               ("PATCH", f"/{resource}/{{{{{singular}_id}}}}", "admin" if resource == "servicos" else "receptionist", {}),
               ("DELETE", f"/{resource}/{{{{{singular}_id}}}}", "admin", None)]
routes += [
    ("POST", "/pecas", "admin", {}), ("GET", "/pecas", "any", None),
    ("GET", "/pecas/{{peca_id}}", "any", None), ("PATCH", "/pecas/{{peca_id}}", "admin", {}),
    ("PATCH", "/pecas/{{peca_id}}/estoque", "admin", {"quantidade": 50}),
    ("DELETE", "/pecas/{{peca_id}}", "admin", None),
    ("POST", "/pecas/fornecedor/solicitar", "admin", {"fornecedorId": "{{fornecedor_id}}", "pecas": [{"pecaId": "{{peca_id}}", "quantidadeSolicitada": 1}]}),
    ("PATCH", "/pecas/fornecedor/pedidos/{{pedido_fornecedor_id}}/receber", "admin", None),
    ("POST", "/pagamentos/registrar", "public", {"ordemServicoId": "{{ordem_id}}", "valor": 1}),
    ("POST", "/webhooks/service-orders/status", "webhook", {"status": "RECEIVED"}),
]

# routes.yaml is the only source of application requests.  The generated
# exports must never grow a second hand-maintained route list.
manifest = yaml.safe_load((ROOT / "docs/http/routes.yaml").read_text(encoding="utf-8"))

def flatten(nodes):
    result = []
    for node in nodes.get("routes", nodes) if isinstance(nodes, dict) else nodes:
        result.extend(flatten(node["routes"])) if "routes" in node else None
        if "method" in node:
            result.append(node)
    return result

manifest_routes = flatten(manifest)
assert len(manifest_routes) == 48 and len({r["id"] for r in manifest_routes}) == 48
role_names = {"customer": "public", "staff": "any", "webhook": "webhook"}
routes = [(r["method"], r["path"].removeprefix("/api/v1"), role_names[r["auth"]], r.get("mock_body")) for r in manifest_routes]

tokens = {"public": "{{customer_token}}", "any": "{{admin_token}}", "admin": "{{admin_token}}", "receptionist": "{{receptionist_token}}", "mechanic": "{{mechanic_token}}", "webhook": "{{webhook_token}}"}
variables = [
    {"key": "base_url", "value": "http://localhost:3000"}, {"key": "admin_email", "value": ""}, {"key": "admin_password", "value": ""},
    {"key": "receptionist_email", "value": ""}, {"key": "receptionist_password", "value": ""}, {"key": "mechanic_email", "value": ""}, {"key": "mechanic_password", "value": ""},
    {"key": "customer_auth_url", "value": ""}, {"key": "customer_cpf", "value": ""}, {"key": "new_password", "value": ""}, {"key": "admin_token", "value": ""}, {"key": "receptionist_token", "value": ""}, {"key": "mechanic_token", "value": ""}, {"key": "customer_token", "value": ""}, {"key": "webhook_token", "value": ""},
    *[{"key": key, "value": ""} for key in ("cliente_id", "veiculo_id", "servico_id", "peca_id", "ordem_id", "fornecedor_id", "pedido_fornecedor_id")],
]

def postman_request(method, path, role, body):
    req = {"name": f"{method} {path}", "request": {"method": method, "header": [], "url": {"raw": BASE + path, "host": [BASE, path]}, "description": f"Role: {role}; 400 is allowed for an intentionally invalid/state-incompatible mock."}}
    if body is not None:
        req["request"]["header"].append({"key": "Content-Type", "value": "application/json"})
        req["request"]["body"] = {"mode": "raw", "raw": json.dumps(body), "options": {"raw": {"language": "json"}}}
    token = tokens[role]
    if role == "webhook":
        req["request"]["header"].append({"key": "X-Webhook-Secret", "value": "{{webhook_token}}"})
    elif token:
        req["request"]["auth"] = {"type": "bearer", "bearer": [{"key": "token", "value": token, "type": "string"}]}
    return req

login_script = """const data = pm.response.json(); const token = data.access_token || data.token; if (token) pm.environment.set(pm.request.name.toLowerCase().includes('receptionist') ? 'receptionist_token' : pm.request.name.toLowerCase().includes('mechanic') ? 'mechanic_token' : 'admin_token', token);"""
login = [postman_request("POST", "/auth/login", "public", {"email": "{{admin_email}}", "password": "{{admin_password}}"}), postman_request("POST", "/auth/login", "public", {"email": "{{receptionist_email}}", "password": "{{receptionist_password}}"}), postman_request("POST", "/auth/login", "public", {"email": "{{mechanic_email}}", "password": "{{mechanic_password}}"})]
for item, name in zip(login, ("Login admin", "Login receptionist", "Login mechanic")):
    item["name"] = name; item["event"] = [{"listen": "test", "script": {"type": "text/javascript", "exec": login_script.splitlines()}}]
customer = postman_request("POST", "", "public", {"cpf": "{{customer_cpf}}"})
customer["request"]["url"] = "{{customer_auth_url}}"
customer["request"].pop("auth", None)
customer["name"] = "Customer CPF login (gateway/auth Lambda)"
customer["event"] = [{"listen": "test", "script": {"type": "text", "exec": ["const data = pm.response.json(); pm.environment.set('customer_token', data.access_token || data.token);"]}}]
postman = {"info": {"name": "Async Furious API - HML/PROD", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", "description": "Import this collection and select either generated HML or PROD environment. Credentials, CPF, tokens and IDs are variables only."}, "variable": variables, "item": [{"name": "Authentication", "item": [customer] + login}, {"name": "Application routes", "item": [postman_request(*r) for r in routes]}]}

insomnia = {"_type": "export", "__export_format": 4, "__export_date": "2026-09-13T00:00:00.000Z", "__export_source": "async-furious.collection-generator", "resources": [{"_id": "wrk_async_furious", "parentId": None, "modified": 0, "created": 0, "name": "Async Furious API - HML/PROD", "description": "Secret-free route collection", "scope": "collection", "_type": "workspace"}]}
for i, (name, url, body, token_name, auth) in enumerate([
    ("Customer CPF login", "{{customer_auth_url}}", {"cpf": "{{customer_cpf}}"}, "customer_token", False),
    ("Login admin", BASE + "/auth/login", {"email": "{{admin_email}}", "password": "{{admin_password}}"}, "admin_token", True),
    ("Login receptionist", BASE + "/auth/login", {"email": "{{receptionist_email}}", "password": "{{receptionist_password}}"}, "receptionist_token", True),
    ("Login mechanic", BASE + "/auth/login", {"email": "{{mechanic_email}}", "password": "{{mechanic_password}}"}, "mechanic_token", True),
]):
    request = {"_id": f"auth_{i:02d}", "parentId": "wrk_async_furious", "modified": 0, "created": 0, "url": url, "name": name, "method": "POST", "body": {"mimeType": "application/json", "text": json.dumps(body)}, "headers": [{"name": "Content-Type", "value": "application/json"}], "authentication": {"type": "bearer", "token": "{{customer_token}}"} if auth else {}, "scripts": {"afterResponse": f"const token = insomnia.response.json().access_token || insomnia.response.json().token; if (token) insomnia.environment.set('{token_name}', token);"}, "_type": "request"}
    insomnia["resources"].append(request)
for i, (method, path, role, body) in enumerate(routes):
    headers = [{"name": "Content-Type", "value": "application/json"}] if body is not None else []
    authentication = {"type": "bearer", "token": tokens[role]} if role != "webhook" and tokens[role] else {}
    if role == "webhook": headers.append({"name": "X-Webhook-Secret", "value": "{{webhook_token}}"})
    insomnia["resources"].append({"_id": f"req_{i:03d}", "parentId": "wrk_async_furious", "modified": 0, "created": 0, "url": BASE + path, "name": f"{method} {path}", "description": f"Role: {role}", "method": method, "body": {"mimeType": "application/json", "text": json.dumps(body)} if body is not None else {}, "headers": headers, "authentication": authentication, "_type": "request"})
for name in ("HML", "PROD"):
    insomnia["resources"].append({"_id": f"env_{name.lower()}", "parentId": "wrk_async_furious", "modified": 0, "created": 0, "name": name, "data": {v["key"]: v["value"] for v in variables} | {"base_url": "", "customer_auth_url": ""}, "_type": "environment"})

out = ROOT / "docs" / "http"
(out / "postman").mkdir(parents=True, exist_ok=True); (out / "insomnia").mkdir(parents=True, exist_ok=True)
def write_json(path, document):
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(document, ensure_ascii=False, indent=2) + "\n")

write_json(out / "postman" / "async-furious.postman_collection.json", postman)
for env in ("hml", "prod"):
    env_doc = {"id": f"async-furious-{env}", "name": f"Async Furious {env.upper()}", "values": [{"key": v["key"], "value": v["value"], "enabled": True} for v in variables]}
    env_doc["values"][0]["value"] = ""
    write_json(out / "postman" / f"async-furious.{env}.postman_environment.json", env_doc)
write_json(out / "insomnia" / "async-furious.insomnia.json", insomnia)
