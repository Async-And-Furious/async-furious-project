"""Read-then-PATCH validation for seeded resources; never prints response bodies."""
import hashlib
import json
import os
import urllib.error
import urllib.request

BASE_URL = os.environ["BASE_URL"].rstrip("/")
CORRELATION_ID = "controlled-patch-" + os.environ.get("GITHUB_RUN_ID", "local")


def request(method, path, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": "Bearer " + token, "X-Correlation-ID": CORRELATION_ID}
    if body is not None:
        headers["Content-Type"] = "application/json"
    url = path if path.startswith("http://") or path.startswith("https://") else BASE_URL + path
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        return error.code, {}


def login(email, password, token):
    status, body = request("POST", "/api/v1/auth/login", token, {"email": email, "password": password})
    if status != 200 or not isinstance(body.get("access_token"), str):
        raise RuntimeError("staff authentication failed")
    return body["access_token"]


def authenticate():
    status, body = request("POST", os.environ["CUSTOMER_AUTH_URL"], "", {"cpf": os.environ["CUSTOMER_CPF"]})
    customer_token = body.get("access_token") or body.get("token")
    if status != 200 or not isinstance(customer_token, str):
        raise RuntimeError("customer authentication failed")
    return {
        "customer": customer_token,
        "admin": login(os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], customer_token),
        "receptionist": login("recepcionista@oficina.com", os.environ["RECEPTIONIST_PASSWORD"], customer_token),
    }


def first_item(collection):
    rows = collection if isinstance(collection, list) else collection.get("data", [])
    return rows[0] if rows else None


def sanitized_id(value):
    return hashlib.sha256(str(value).encode()).hexdigest()[:12]


def changed_value(resource, item, field):
    original = item.get(field)
    if not isinstance(original, str):
        raise RuntimeError(resource + " has no usable " + field + " field")
    candidate = original + " [validation]"
    return candidate[:100] if resource == "cliente" else candidate


def validate_resource(tokens, resource, collection_path, patch_path, role, field):
    status, collection = request("GET", collection_path, tokens["admin"])
    item = first_item(collection) if status == 200 else None
    if item is None or not item.get("id"):
        raise RuntimeError(resource + " collection did not return a seeded item")
    item_id = item["id"]
    path = patch_path.replace("{id}", str(item_id))
    original = item.get(field)
    changed = changed_value(resource, item, field)
    display_path = patch_path.replace("{id}", "<id>")
    print(f"{resource} GET {collection_path} {status} {sanitized_id(item_id)}")
    patch_status, _ = request("PATCH", path, tokens[role], {field: changed})
    print(f"{resource} PATCH {display_path} {patch_status} {sanitized_id(item_id)}")
    if patch_status in (200, 201):
        restore_status, _ = request("PATCH", path, tokens[role], {field: original})
        print(f"{resource} PATCH {display_path} {restore_status} {sanitized_id(item_id)}")
    return [status, patch_status]


def validate_stock(tokens):
    status, collection = request("GET", "/api/v1/pecas", tokens["admin"])
    item = first_item(collection) if status == 200 else None
    quantity = item.get("quantidade_estoque") if item else None
    if item is None or not item.get("id") or not isinstance(quantity, (int, float)):
        raise RuntimeError("estoque collection did not return a seeded item with quantity")
    item_id = item["id"]
    path = f"/api/v1/pecas/{item_id}/estoque"
    display_path = "/api/v1/pecas/<id>/estoque"
    print(f"estoque GET /api/v1/pecas {status} {sanitized_id(item_id)}")
    patch_status, _ = request("PATCH", path, tokens["admin"], {"quantidade": quantity + 1})
    print(f"estoque PATCH {display_path} {patch_status} {sanitized_id(item_id)}")
    if patch_status in (200, 201):
        restore_status, _ = request("PATCH", path, tokens["admin"], {"quantidade": quantity})
        print(f"estoque PATCH {display_path} {restore_status} {sanitized_id(item_id)}")
    return [status, patch_status]


def main():
    tokens = authenticate()
    results = [
        validate_resource(tokens, "cliente", "/api/v1/clientes", "/api/v1/clientes/{id}", "receptionist", "nome"),
        validate_resource(tokens, "veiculo", "/api/v1/veiculos", "/api/v1/veiculos/{id}", "receptionist", "marca"),
        validate_resource(tokens, "servico", "/api/v1/servicos", "/api/v1/servicos/{id}", "admin", "nome"),
        validate_resource(tokens, "peca", "/api/v1/pecas", "/api/v1/pecas/{id}", "admin", "nome"),
        validate_stock(tokens),
        validate_resource(tokens, "ordem-servico", "/api/v1/ordens-servico", "/api/v1/ordens-servico/{id}", "admin", "descricao"),
    ]
    if any(status in (400, 401, 403, 404) for pair in results for status in pair):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
