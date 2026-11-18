#!/usr/bin/env python3
"""`aws` falso para test/deploy/eks-endpoint-update.spec.ts.

Lê e grava o cenário em $FAKE_AWS_STATE (JSON) e registra cada chamada em $FAKE_AWS_LOG:
- config: resourcesVpcConfig atual do cluster;
- missing: true simula cluster inexistente (ResourceNotFoundException);
- update_errors: erros devolvidos pelos próximos update-cluster-config, um por chamada;
- update_status: status final dos updates aceitos (padrão Successful);
- after_update: configurações que outro deploy grava logo depois de cada update aceito.
"""

import json
import os
import sys

state_path = os.environ["FAKE_AWS_STATE"]
with open(state_path) as arquivo:
    state = json.load(arquivo)
with open(os.environ["FAKE_AWS_LOG"], "a") as log:
    log.write(" ".join(sys.argv[1:3]) + "\n")


def salvar():
    with open(state_path, "w") as arquivo:
        json.dump(state, arquivo)


def opcao(nome):
    return sys.argv[sys.argv.index(nome) + 1]


def nao_encontrado():
    print("An error occurred (ResourceNotFoundException): No cluster found", file=sys.stderr)
    sys.exit(254)


comando = sys.argv[2]
if comando == "wait":
    sys.exit(255 if state.get("missing") else 0)
if comando == "describe-cluster":
    if state.get("missing"):
        nao_encontrado()
    print(json.dumps(state["config"]))
elif comando == "update-cluster-config":
    if state.get("missing"):
        nao_encontrado()
    erros = state.get("update_errors", [])
    if erros:
        erro = erros.pop(0)
        salvar()
        print(f"An error occurred ({erro})", file=sys.stderr)
        sys.exit(254)
    valores = opcao("--resources-vpc-config")
    antes, _, cidrs = valores.partition(",publicAccessCidrs=")
    pares = dict(item.split("=") for item in antes.split(","))
    state["config"] = {
        "endpointPrivateAccess": pares["endpointPrivateAccess"] == "true",
        "endpointPublicAccess": pares["endpointPublicAccess"] == "true",
        "publicAccessCidrs": cidrs.split(",") if cidrs else ["0.0.0.0/0"],
    }
    state.setdefault("applied", []).append(valores)
    depois = state.get("after_update", [])
    if depois:
        state["config"] = depois.pop(0)
    salvar()
    print(f"upd-{len(state['applied'])}")
elif comando == "describe-update":
    print(state.get("update_status", "Successful"))
else:
    print(f"comando não simulado: {comando}", file=sys.stderr)
    sys.exit(2)
