"""Run the non-destructive route matrix without printing credentials or bodies."""
import json, os, sys, urllib.error, urllib.request

base = os.environ["BASE_URL"].rstrip("/")
def value(name): return base if name == "base_url" else os.environ.get(name, "")
def expand(text):
    for key in ("base_url", "cliente_id", "veiculo_id", "servico_id", "peca_id", "ordem_id", "fornecedor_id", "pedido_fornecedor_id"):
        text = text.replace("{{" + key + "}}", value(key))
    return text

def call(method, url, token="", body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"X-Correlation-ID": "route-matrix-" + os.environ.get("GITHUB_RUN_ID", "local")}
    if token: headers["Authorization"] = "Bearer " + token
    if body is not None: headers["Content-Type"] = "application/json"
    request = urllib.request.Request(expand(url), data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        return error.code, {}

def login(email_key, password_key):
    status, body = call("POST", base + "/api/v1/auth/login", body={"email": value(email_key), "password": value(password_key)})
    if status != 200 or not isinstance(body.get("access_token"), str): raise RuntimeError("staff login failed")
    return body["access_token"]

tokens = {"admin": login("ADMIN_EMAIL", "ADMIN_PASSWORD"), "receptionist": login("RECEPTIONIST_EMAIL", "RECEPTIONIST_PASSWORD"), "mechanic": login("MECHANIC_EMAIL", "MECHANIC_PASSWORD")}
if value("CUSTOMER_AUTH_URL"):
    status, body = call("POST", value("CUSTOMER_AUTH_URL"), body={"cpf": value("CUSTOMER_CPF")})
    if status != 200 or not isinstance(body.get("access_token"), str): raise RuntimeError("customer login failed")
    tokens["customer"] = body["access_token"]

collection = json.load(open(os.path.join(os.path.dirname(__file__), "..", "docs", "http", "postman", "async-furious.postman_collection.json"), encoding="utf-8"))
items = collection["item"][1]["item"]
role_token = {"public": "", "any": tokens["admin"], "admin": tokens["admin"], "receptionist": tokens["receptionist"], "mechanic": tokens["mechanic"], "webhook": value("WEBHOOK_TOKEN")}
failures = 0; skipped = 0
for item in items:
    req = item["request"]; method = req["method"]; url = req["url"]["raw"]
    if method == "DELETE": skipped += 1; continue
    role = item["description"].split("Role: ", 1)[-1].split(";", 1)[0]
    raw = req.get("body", {}).get("raw")
    body = json.loads(expand(raw)) if raw else None
    status, _ = call(method, url, role_token.get(role, ""), body)
    print(f"{method} {url.split('/api/v1')[-1] or '/'} => {status}")
    if status in (401, 403): failures += 1
if skipped: print(f"DELETE routes skipped (destructive-request policy): {skipped}")
if failures: sys.exit(1)
