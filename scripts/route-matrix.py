"""Run the non-destructive route matrix without printing credentials or bodies."""
import json, os, sys, urllib.error, urllib.request

base = os.environ["BASE_URL"].rstrip("/")
SAFE_UUID = "00000000-0000-0000-0000-000000000000"
def value(name): return base if name == "base_url" else os.environ.get(name, "")
def expand(text, safe_ids=False):
    for key in ("base_url", "cliente_id", "veiculo_id", "servico_id", "peca_id", "ordem_id", "fornecedor_id", "pedido_fornecedor_id"):
        replacement = value(key)
        if key != "base_url" and safe_ids:
            replacement = SAFE_UUID
        elif key != "base_url":
            replacement = os.environ.get(key.upper()) or value(key)
        text = text.replace("{{" + key + "}}", replacement)
    return text

def call(method, url, token="", body=None, webhook_secret=""):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"X-Correlation-ID": "route-matrix-" + os.environ.get("GITHUB_RUN_ID", "local")}
    if webhook_secret:
        headers["X-Webhook-Secret"] = webhook_secret
    elif token:
        headers["Authorization"] = "Bearer " + token
    if body is not None: headers["Content-Type"] = "application/json"
    request = urllib.request.Request(expand(url), data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        return error.code, {}

def login(email_key, password_key, token):
    status, body = call("POST", base + "/api/v1/auth/login", token, {"email": value(email_key), "password": value(password_key)})
    if status != 200 or not isinstance(body.get("access_token"), str): raise RuntimeError("staff login failed")
    return body["access_token"]

customer_auth_url = value("CUSTOMER_AUTH_URL")
if not customer_auth_url: raise RuntimeError("CUSTOMER_AUTH_URL is required")
status, body = call("POST", customer_auth_url, body={"cpf": value("CUSTOMER_CPF")})
customer_token = body.get("access_token") or body.get("token")
if status != 200 or not isinstance(customer_token, str): raise RuntimeError("customer login failed")
tokens = {"customer": customer_token}
tokens.update({"admin": login("ADMIN_EMAIL", "ADMIN_PASSWORD", customer_token), "receptionist": login("RECEPTIONIST_EMAIL", "RECEPTIONIST_PASSWORD", customer_token), "mechanic": login("MECHANIC_EMAIL", "MECHANIC_PASSWORD", customer_token)})

def first_id(path, token):
    status, body = call("GET", base + "/api/v1/" + path, token)
    if isinstance(body, list):
        rows = body
    else:
        rows = body.get("data", [])
    if status == 200 and rows:
        return rows[0].get("id", "")
    return ""

for key, path in (("cliente_id", "clientes"), ("veiculo_id", "veiculos"), ("servico_id", "servicos"), ("peca_id", "pecas"), ("ordem_id", "ordens-servico")):
    if not value(key): os.environ[key.upper()] = first_id(path, tokens["admin"])

collection = json.load(open(os.path.join(os.path.dirname(__file__), "..", "docs", "http", "postman", "async-furious.postman_collection.json"), encoding="utf-8"))
items = collection["item"][1]["item"]
webhook_secret = value("WEBHOOK_TOKEN")
if not webhook_secret: raise RuntimeError("WEBHOOK_TOKEN is required")
role_token = {"public": tokens["customer"], "any": tokens["admin"], "admin": tokens["admin"], "receptionist": tokens["receptionist"], "mechanic": tokens["mechanic"]}
failures = 0; skipped = 0
for item in items:
    req = item["request"]; method = req["method"]; url = req["url"]["raw"]
    if method == "DELETE": skipped += 1; continue
    role = req.get("description", "Role: public").split("Role: ", 1)[-1].split(";", 1)[0]
    raw = req.get("body", {}).get("raw")
    safe_ids = method in {"POST", "PATCH"} and not url.endswith("/auth/login")
    body = json.loads(expand(raw, safe_ids)) if raw else None
    if role == "webhook":
        status, _ = call(method, expand(url, safe_ids), body=body, webhook_secret=webhook_secret)
    else:
        status, _ = call(method, expand(url, safe_ids), role_token.get(role, tokens["customer"]), body)
    print(f"{method} {url.split('/api/v1')[-1] or '/'} => {status}")
    if status in (401, 403): failures += 1
if skipped: print(f"DELETE routes skipped (destructive-request policy): {skipped}")
if failures: sys.exit(1)
