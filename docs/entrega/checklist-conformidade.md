# Checklist de conformidade — entrega da Fase 4

**Estado: rascunho; nenhum item foi verificado neste documento.** As fontes
abaixo orientam a coleta de evidências, mas não comprovam implantação,
configuração, disponibilidade pública ou conclusão. Preencher cada evidência
com link ou referência identificável, data e resultado antes de marcar o item.
Não incluir credenciais, dados pessoais desnecessários ou informações sensíveis.

Escopo: [issue #352](https://github.com/Async-And-Furious/async-furious-project/issues/352)
e enunciado da Fase 4. O PDF final deve ser montado **após a publicação do
vídeo** e revisado por outra pessoa antes da submissão.

## Conteúdo do PDF

| Item do enunciado / aceite | Onde procurar ou como provar | Estado / evidência |
|---|---|---|
| Participantes | Confirmar nome e identificação exigidos de cada participante com o grupo. | Pendente — dados e revisão não confirmados. |
| Repositórios dos três microsserviços | Listar separadamente [OS](https://github.com/Async-And-Furious/async-furious-project), [Billing](https://github.com/Async-And-Furious/repo-billing) e [Execução](https://github.com/Async-And-Furious/repo-execucao-service); abrir os links deslogado. | Pendente — acessibilidade pública não conferida. |
| Repositórios de infraestrutura e borda | Em lista separada: [Kubernetes](https://github.com/Async-And-Furious/repo-k8s-infra), [bancos](https://github.com/Async-And-Furious/repo-db-infra) e [autenticação](https://github.com/Async-And-Furious/repo-auth-serverless); abrir os links deslogado. | Pendente — acessibilidade pública não conferida. |
| Vídeo publicado | Conferir YouTube ou Vimeo, público ou não listado, duração de até 15 minutos e acesso em janela anônima; registrar URL. Na [#353](https://github.com/Async-And-Furious/async-furious-project/issues/353), conferir os quatro blocos: fluxo de OS entre serviços, Saga e falha, deploy automatizado com testes, e monitoramento/rastreamento distribuído. | Pendente — URL e conteúdo não verificados. |
| Diagrama geral legível | Localizar o diagrama-mestre versionado com microsserviços, bancos e comunicação e inserir PNG exportado do Mermaid; verificar legibilidade no PDF. | Pendente — versão e exportação não conferidas. |
| Estratégia Saga | Resumir a [ADR-0016](../adr/0016-saga-coreografada.md) e o [fluxo Saga](../architecture/saga-flow.md): coreografia, justificativa e trade-off. Distinguir desenho alvo de comportamento comprovado. | Pendente — texto e revisão não concluídos. |
| Divisão e tecnologias | Consultar [ADR-0017](../adr/0017-divisao-microsservicos-ownership-dados.md), [ADR-0018](../adr/0018-mensageria-contratos-eventos.md) e [ADR-0020](../adr/0020-bancos-compartilhados-isolamento-credencial.md); explicar responsabilidades, isolamento e função do Kafka. Conferir ADR do DocumentDB antes de explicar seu papel como read model. | Pendente — fontes e justificativa final precisam de conferência. |
| Papel adicional do OS Service | Explicar sua função como repositório de documentação, BDD e read model; conferir os artefatos citados. | Pendente — referências finais não conferidas. |

## Evidências de conformidade

| Item do enunciado / aceite | Evidência a anexar ou referenciar | Estado / evidência |
|---|---|---|
| `main` protegida em cada repositório | Para cada um dos seis repositórios citados, registrar evidência atual da proteção, PR obrigatório e checks automáticos. | Pendente — verificação individual não registrada. |
| Testes e qualidade por microsserviço | Para OS, Billing e Execução, registrar testes unitários, cobertura mínima de 80% e análise de qualidade no CI; conferir a evidência de cobertura no respectivo README. | Pendente — evidências dos três serviços não registradas. |
| Fluxo BDD completo | Identificar o cenário BDD completo, seu resultado e a revisão correspondente. | Pendente — evidência não registrada. |
| Saga e compensações implementadas | Identificar, no código e nas evidências de testes, o fluxo implementado e o tratamento de falhas e compensações; separar o desenho alvo do comportamento efetivamente comprovado. | Pendente — cobertura e evidências não verificadas. |
| Bancos e isolamento | Verificar evidências dos bancos SQL e NoSQL exigidos e de que nenhum serviço acessa diretamente o banco de outro. | Pendente — configuração e isolamento não comprovados. |
| Entregáveis em cada repositório de microsserviço | Para OS, Billing e Execução, conferir código-fonte, Dockerfile, manifestos Kubernetes, pipelines CI/CD, documentação de arquitetura e Swagger ou collection Postman atualizada. | Pendente — verificação individual não registrada. |
| CI/CD independente e deploy em Kubernetes | Para cada microsserviço, conferir pipeline independente com build, testes, verificação de qualidade e deploy automatizado em Kubernetes. Referenciar evidências verificáveis; existência de YAML isoladamente não comprova execução. | Pendente — evidência não registrada. |
| Observabilidade reaproveitada | Apontar configuração e evidência verificável correspondente à exigência da Fase 4. | Pendente — evidência não registrada. |
| Justificativa de Saga em cada README de serviço | Conferir o texto no README publicado dos três serviços e registrar links para os trechos. | Pendente — três verificações não registradas. |
| Visibilidade e links da entrega | Abrir, em sessão anônima, todos os links efetivamente citados no PDF, inclusive o vídeo. | Pendente — teste não realizado. |
| `async-furious-front` | Conferir a situação frente ao aceite da #352; qualquer arquivamento ou exclusão exige a autorização aplicável. | Pendente — nenhuma alteração efetuada. |
| Roteiro, checklist e PDF versionados | Verificar os três arquivos finais em `docs/entrega/`; o roteiro está na [#353](https://github.com/Async-And-Furious/async-furious-project/issues/353). | Pendente — este checklist é rascunho, não o PDF final. |
| Revisão independente e envio | Registrar revisor diferente do autor e comprovante de submissão ao portal FIAP. | Pendente — não realizados. |

**Conclusão:** não fechar este checklist enquanto houver item pendente ou sem
evidência verificável. Uma pendência deve ser encaminhada ao responsável pela
respectiva frente, não substituída por suposição.
