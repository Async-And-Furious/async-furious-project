#!/usr/bin/env python3
"""Abertura e restauração do endpoint público do EKS durante o deploy.

Uso: eks_endpoint_access.py open <atual.json> <cidr-do-runner>
     eks_endpoint_access.py restore <original.json> <atual.json> <cidr-do-runner>

Imprime o valor de --resources-vpc-config, ou nada (restore) se o endpoint já está como
deve ficar.

Abertura: com o acesso público ligado, acrescenta o /32 do runner à lista atual. Com o
endpoint só privado, abre apenas para o runner: nesse caso o EKS devolve
publicAccessCidrs = ["0.0.0.0/0"], e acrescentar o /32 a essa lista abriria o endpoint
para a internet inteira durante o deploy.

O OS, o Billing e o Execução liberam o IP do próprio runner no mesmo cluster, e o
`concurrency` de cada workflow só vale dentro do repositório. Por isso a restauração parte da
configuração ATUAL, não da salva no início do run: tira só o /32 deste run (se ele não estava
na lista original) e mantém o que outros deploys liberaram depois. Depois disso:
- se não sobrou nenhum CIDR, o acesso público é desligado: todos eram de runners, e acesso
  público com lista vazia valeria como 0.0.0.0/0;
- se sobrou CIDR que não estava na foto original, outro deploy ainda usa o endpoint: fica
  ligado, e ele mesmo restaura ao terminar;
- senão, o acesso público volta ao valor da foto original. A mesma regra está em `eks_acesso_restaurado`
(scripts/deploy/infra.sh) no repo-billing.
"""

import json
import sys


def acesso_aberto(atual: dict, cidr_runner: str) -> str:
    if atual["endpointPublicAccess"]:
        cidrs = list(dict.fromkeys([*(atual.get("publicAccessCidrs") or []), cidr_runner]))
    else:
        cidrs = [cidr_runner]
    return (
        f"endpointPrivateAccess={str(atual['endpointPrivateAccess']).lower()},"
        f"endpointPublicAccess=true,publicAccessCidrs={','.join(cidrs)}"
    )


def acesso_restaurado(original: dict, atual: dict, cidr_runner: str) -> str:
    originais = original.get("publicAccessCidrs") or []
    atuais = atual.get("publicAccessCidrs") or []
    if cidr_runner in originais:
        cidrs = list(atuais)
    else:
        cidrs = [cidr for cidr in atuais if cidr != cidr_runner]
    if not cidrs:
        publico = False
    elif any(cidr not in originais for cidr in cidrs):
        publico = True
    else:
        publico = bool(original["endpointPublicAccess"])

    if not publico and not atual["endpointPublicAccess"]:
        return ""
    if publico and atual["endpointPublicAccess"] and sorted(cidrs) == sorted(atuais):
        return ""
    acesso = (
        f"endpointPrivateAccess={str(atual['endpointPrivateAccess']).lower()},"
        f"endpointPublicAccess={str(publico).lower()}"
    )
    if cidrs:
        acesso += f",publicAccessCidrs={','.join(cidrs)}"
    return acesso


def main(argv: list[str]) -> int:
    if len(argv) == 4 and argv[1] == "open":
        with open(argv[2]) as atual:
            print(acesso_aberto(json.load(atual), argv[3]))
        return 0
    if len(argv) == 5 and argv[1] == "restore":
        with open(argv[2]) as original, open(argv[3]) as atual:
            print(acesso_restaurado(json.load(original), json.load(atual), argv[4]))
        return 0
    print("\n".join(__doc__.strip().splitlines()[2:4]), file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
