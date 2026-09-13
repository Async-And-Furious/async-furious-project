"""Generate secret-free Postman and Insomnia exports from the route contract."""
import json
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
    routes += [("POST", f"/{resource}", "receptionist", {}), ("GET", f"/{resource}", "any", None),
               ("GET", f"/{resource}/{{{{{singular}_id}}}}", "any", None),
               ("PATCH", f"/{resource}/{{{{{singular}_id}}}}", "receptionist", {}),
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
order_id = "{{ordem_id}}"
routes += [
    ("POST", "/ordens-servico", "receptionist", {"veiculoId": "{{veiculo_id}}", "clienteId": "{{cliente_id}}", "descricao": "Collection smoke order"}),
    ("GET", "/ordens-servico", "any", None), ("GET", "/ordens-servico/tempo-medio", "admin", None),
    ("GET", f"/ordens-servico/{order_id}", "any", None), ("GET", f"/ordens-servico/{order_id}/status", "public", None),
    ("GET", f"/ordens-servico/{order_id}/rastreamento", "public", None),
    ("PATCH", f"/ordens-servico/{order_id}", "admin", {"descricao": "Collection smoke update"}),
    ("DELETE", f"/ordens-servico/{order_id}", "admin", None),
    ("PATCH", f"/ordens-servico/{order_id}/assumir", "mechanic", None),
    ("PATCH", f"/ordens-servico/{order_id}/analisar", "mechanic", None),
    ("PATCH", f"/ordens-servico/{order_id}/servicos-insumos", "mechanic", {"valor_total_servicos": 1, "valor_total_pecas": 1}),
    ("PATCH", f"/ordens-servico/{order_id}/orcamento/aprovar", "public", None),
    ("PATCH", f"/ordens-servico/{order_id}/orcamento/recusar", "public", None),
    ("PATCH", f"/ordens-servico/{order_id}/finalizar-execucao", "mechanic", None),
    ("PATCH", f"/ordens-servico/{order_id}/aprovar-servico", "public", None),
    ("POST", f"/ordens-servico/{order_id}/aprovar-servico", "public", {"decisao": "APROVADO"}),
    ("PATCH", f"/ordens-servico/{order_id}/registrar-entrega", "receptionist", None),
]

tokens = {"public": "", "any": "{{admin_token}}", "admin": "{{admin_token}}", "receptionist": "{{receptionist_token}}", "mechanic": "{{mechanic_token}}", "webhook": "{{webhook_token}}"}
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
    if token:
        req["request"]["auth"] = {"type": "bearer", "bearer": [{"key": "token", "value": token, "type": "string"}]}
    return req

login_script = """const data = pm.response.json(); const token = data.access_token || data.token; if (token) pm.environment.set(pm.request.name.toLowerCase().includes('receptionist') ? 'receptionist_token' : pm.request.name.toLowerCase().includes('mechanic') ? 'mechanic_token' : 'admin_token', token);"""
login = [postman_request("POST", "/auth/login", "public", {"email": "{{admin_email}}", "password": "{{admin_password}}"}), postman_request("POST", "/auth/login", "public", {"email": "{{receptionist_email}}", "password": "{{receptionist_password}}"}), postman_request("POST", "/auth/login", "public", {"email": "{{mechanic_email}}", "password": "{{mechanic_password}}"})]
for item, name in zip(login, ("Login admin", "Login receptionist", "Login mechanic")):
    item["name"] = name; item["event"] = [{"listen": "test", "script": {"type": "text/javascript", "exec": login_script.splitlines()}}]
customer = postman_request("POST", "", "public", {"cpf": "{{customer_cpf}}"})
customer["request"]["url"] = "{{customer_auth_url}}"
customer["name"] = "Customer CPF login (gateway/auth Lambda)"
customer["event"] = [{"listen": "test", "script": {"type": "text", "exec": ["const data = pm.response.json(); pm.environment.set('customer_token', data.access_token || data.token);"]}}]
postman = {"info": {"name": "Async Furious API - HML/PROD", "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", "description": "Import this collection and select either generated HML or PROD environment. Credentials, CPF, tokens and IDs are variables only."}, "variable": variables, "item": [{"name": "Authentication", "item": login + [customer]}, {"name": "Application routes", "item": [postman_request(*r) for r in routes]}]}

insomnia = {"_type": "export", "__export_format": 4, "__export_date": "2026-09-13T00:00:00.000Z", "__export_source": "async-furious.collection-generator", "resources": [{"_id": "wrk_async_furious", "parentId": None, "modified": 0, "created": 0, "name": "Async Furious API - HML/PROD", "description": "Secret-free route collection", "scope": "collection", "_type": "workspace"}]}
for i, (method, path, role, body) in enumerate(routes):
    insomnia["resources"].append({"_id": f"req_{i:03d}", "parentId": "wrk_async_furious", "modified": 0, "created": 0, "url": BASE + path, "name": f"{method} {path}", "description": f"Role: {role}", "method": method, "body": {"mimeType": "application/json", "text": json.dumps(body)} if body is not None else {}, "headers": [{"name": "Content-Type", "value": "application/json"}] if body is not None else [], "authentication": {"type": "bearer", "token": tokens[role]} if tokens[role] else {}, "_type": "request"})
for name in ("HML", "PROD"):
    insomnia["resources"].append({"_id": f"env_{name.lower()}", "parentId": "wrk_async_furious", "modified": 0, "created": 0, "name": name, "data": {v["key"]: v["value"] for v in variables} | {"base_url": "", "customer_auth_url": ""}, "_type": "environment"})

out = ROOT / "docs" / "http"
(out / "postman").mkdir(parents=True, exist_ok=True); (out / "insomnia").mkdir(parents=True, exist_ok=True)
(out / "postman" / "async-furious.postman_collection.json").write_text(json.dumps(postman, ensure_ascii=False, indent=2) + "\n")
for env in ("hml", "prod"):
    env_doc = {"id": f"async-furious-{env}", "name": f"Async Furious {env.upper()}", "values": [{"key": v["key"], "value": v["value"], "enabled": True} for v in variables]}
    env_doc["values"][0]["value"] = ""
    (out / "postman" / f"async-furious.{env}.postman_environment.json").write_text(json.dumps(env_doc, indent=2) + "\n")
(out / "insomnia" / "async-furious.insomnia.json").write_text(json.dumps(insomnia, ensure_ascii=False, indent=2) + "\n")
