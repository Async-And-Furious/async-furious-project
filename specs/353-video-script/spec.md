# Especificação — roteiro do vídeo de microserviços (#353)

## Objetivo

Definir um roteiro versionável em `docs/entrega/` para demonstrar, em até 15
minutos, os fluxos de negócio e a arquitetura de microserviços da oficina. Esta
fase especifica o conteúdo; não escreve o roteiro final nem executa a demo.

## Limites e segurança

- Quatro blocos, duração total máxima de 15 minutos; tempos são orçamento, não
  alegação de ensaio realizado.
- Narrar apenas o que estiver visível e verificável no ambiente usado. Não
  afirmar deploy HML, traces entre serviços, dashboard preenchido, nem ensaio
  realizado sem evidência observada.
- Usar fallback verdadeiro: declarar explicitamente o que não foi validado;
  não simular resultados nem apresentar gravação anterior como resultado atual.
- Não incluir CPF, dados de cartão, tokens, senhas, URLs privadas ou credenciais
  no roteiro, captura de tela ou artefatos.
- Não prometer uma tela de “estado da saga por OS”: ela não existe.
- Gravação, edição e publicação são fora do escopo desta especificação.

## Estrutura proposta (15:00 no máximo)

| Bloco | Limite | Conteúdo e evidência exigida |
|---|---:|---|
| 1. Contexto e caminho feliz | 4:00 | Apresentar os três serviços e a saga coreografada; mostrar OS avançando até execução concluída somente se o fluxo estiver disponível e comprovado no ambiente. Evidência: estado/resultado observável das telas utilizadas. |
| 2. Falha e compensação | 4:00 | Mostrar pagamento recusado e compensações efetivamente observadas; priorizar esse cenário se só um couber. Não afirmar cancelamentos ou reserva liberada sem evidência por serviço. O cenário de OS parada é opcional e só entra se validado. |
| 3. Serviços e entrega | 3:00 | Apresentar repositórios/serviços e pipeline(s) existentes; mostrar somente runs e deploys verificáveis. Não inferir HML a partir de código ou workflow. |
| 4. Observabilidade e encerramento | 4:00 | Mostrar traces/logs/dashboard apenas conforme existirem. Explicar que uma saga pode ter vários traces ligados por `ordemServicoId`; se trace distribuído não estiver validado, declarar isso e mostrar apenas evidências locais disponíveis. |

Os tempos incluem fala, navegação e encerramento. Se evidências não estiverem
prontas, reduzir o conteúdo ou declarar a pendência; nunca exceder 15 minutos
nem substituir evidência ausente por uma afirmação.

## Requisitos do roteiro final

1. Cada bloco contém fala-guia, ação/tela e evidência verificável esperada.
2. Cada afirmação de ambiente ou resultado aponta a evidência observada, com
   data/ambiente quando relevante; itens não verificados aparecem como
   pendências, não como fatos.
3. Incluir fallback honesto por bloco: mostrar apenas o que ocorreu e dizer o
   que não foi validado. Nenhum endpoint de falha artificial ou serviço parado.
4. Manter dados sensíveis fora do material e mascarar dados pessoais exibidos.
5. Identificar como pendentes até confirmação explícita: preparação/validação
   de HML, disponibilidade de acessos seguros, ensaio humano ponta a ponta,
   gravação, revisão humana, edição e publicação. As datas mencionadas no
   comentário de 03/11 (#353) são planejamento, não confirmação de execução.

## Fora do escopo desta fase

- Escrever/adicionar o roteiro final em `docs/entrega/`.
- Preparar ou alterar massa, configuração ou infraestrutura de HML.
- Acessar AWS/Kubernetes, disparar workflows/CronJobs ou validar serviços.
- Gravar, editar, revisar ou publicar o vídeo.
- Alterar serviços, observabilidade, pipelines ou contratos.

## Referências de entrada

- Issue central #353 e comentário de organização de 03/11.
- Issue #341 e `docs/runbooks/demo-flows.md` (referência de execução; não prova
  que os fluxos estejam atualmente implantados ou ensaiados).
