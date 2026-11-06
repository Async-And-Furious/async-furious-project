# Roteiro do vídeo de demonstração — microserviços da oficina (#353)

**Duração orçada:** 14:00 (máximo: 15:00). Tempos incluem fala, navegação e
transições; a distribuição reserva 3 min ao caminho feliz, 5 min à falha e
compensação, 2:30 à entrega e 3:30 à observabilidade. Os dois fluxos de negócio
e a observabilidade recebem a maior parte do tempo por serem as evidências
centrais da demonstração; 1 min fica como margem, não como extensão planejada.
Isto não é resultado de ensaio. **Estado:** pendente de
validação humana e operacional. Este documento não afirma que HML, deploy,
traces ou qualquer cenário estejam prontos.

> Antes de gravar, confirmar a disponibilidade das evidências de cada bloco.
> Se não estiverem disponíveis, usar o fallback indicado e declarar a
> limitação. Não completar telas nem resultados por suposição.

## Bloco 1 — Contexto e caminho feliz (3:00)

**Fala-guia:** “O sistema é dividido em OS Service, Billing Service e Execução e
Produção. Os serviços colaboram por eventos; a demonstração acompanha uma ordem
de serviço desde a abertura até a execução concluída.”

**Ação:** apresentar brevemente os três serviços e, se o caminho estiver
disponível no ambiente da demonstração, percorrer a OS de teste pelas telas e
ações existentes: abertura, diagnóstico, orçamento/aprovação, pagamento e
etapas do mecânico até conclusão.

**Evidência necessária:** telas/resultados observáveis que identifiquem a mesma
OS e comprovem cada transição mostrada, inclusive execução concluída. Usar
somente IDs de OS sintéticos/de demonstração, autorizados para compartilhamento
e consistentes entre os serviços. Esses IDs não são dados pessoais por si só,
mas não usar IDs reais ou associados a clientes. Ocultar dados pessoais nas
telas e gravações.

**Fallback honesto:** se o fluxo ponta a ponta não estiver disponível ou faltar
uma transição, mostrar somente o trecho verificável e dizer qual etapa não foi
validada. Não narrar o fluxo como concluído.

## Bloco 2 — Pagamento recusado e compensação (5:00)

**Fala-guia:** “Agora observamos uma falha de negócio. A compensação só será
descrita para os efeitos que as evidências confirmarem em cada serviço.”

**Ação:** somente após verificar os pré-requisitos relevantes (#328 e #338) e
validar o fluxo, consultar um cenário de demonstração autorizado; mostrar o
resultado público da OS e as evidências autorizadas disponíveis para pagamento,
execução e histórico. O resultado que se pretende comprovar é pagamento
`RECUSADO`, OS `CLOSED_WITHOUT_EXECUTION` e histórico correspondente. Exibir
apenas o que foi observado; não mostrar consultas com segredos ou dados pessoais.

**Evidência necessária:** status observado, confirmação autorizada do pagamento
e, quando disponíveis, histórico com motivo e estado da execução. Cada
compensação exige evidência própria; uma tela não prova o estado dos outros
serviços.

**Fallback honesto:** se o cenário ou alguma compensação não estiver validado,
dizer isso e mostrar somente evidências confirmadas. Não alegar estorno: no
cenário de recusa nada foi capturado. A OS parada/detector fica fora do corte
planejado; só pode ser acrescentada se estiver validada e houver tempo dentro do
limite total. Não derrubar serviço nem criar falha artificial.

## Bloco 3 — Serviços e entrega (2:30)

**Fala-guia:** “Os serviços têm repositórios e ciclos de entrega próprios. Aqui
está o que conseguimos comprovar nesta execução.”

**Ação:** mostrar os repositórios e, se acessíveis, runs de CI/CD relevantes;
mostrar deploy somente quando o run e a evidência correspondente estiverem
visíveis e identificarem o ambiente/versão apresentados.

**Evidência necessária:** run real, resultado dos checks e, para qualquer
alegação de deploy, evidência explícita do deploy no ambiente citado. Código ou
workflow existente, por si só, não comprova deploy em HML.

**Fallback honesto:** se não houver run/deploy verificável, apresentar apenas a
estrutura dos repositórios e informar que o deploy não foi confirmado. Não
afirmar que HML está atualizado.

## Bloco 4 — Observabilidade e encerramento (3:30)

**Fala-guia:** “Uma saga pode gerar vários traces, iniciados por ações distintas;
`ordemServicoId` permite relacionar as evidências quando a correlação estiver
instrumentada. Não pressupomos um único trace cobrindo toda a saga.”

**Ação:** se estiver disponível, filtrar traces e logs por `ordemServicoId` e
mostrar as linhas/spans efetivamente observadas. Apresentar dashboard somente
se houver dados visíveis e verificáveis. Encerrar recapitulando o que foi
demonstrado e o que ficou pendente.

**Evidência necessária:** traces com serviços/broker visíveis para a OS,
correlação observável nos logs e dashboard preenchido, cada um verificado
separadamente. A issue #341 descreve fluxos de referência; sua existência não
prova que estejam disponíveis agora.

**Fallback honesto:** se tracing distribuído não estiver validado, dizer isso;
mostrar apenas logs/traces locais ou outra evidência realmente disponível. Não
usar dashboard para preencher lacunas nem afirmar que existe tela de “estado da
saga por OS” — ela não existe.

## Bloqueios e pendências antes da entrega

- **HML:** confirmar preparação e validação do ambiente, acessos autorizados e
  evidências sem expor endpoints privados ou credenciais.
- **Pré-requisitos de fluxo/compensação:** verificar o estado e as evidências
  requeridas nas issues #328 e #338 antes de escolher ou narrar o cenário. Esta
  referência não declara nenhuma delas concluída.
- **Ensaio:** realizar revisão humana e ensaio ponta a ponta, cronometrar os
  quatro blocos e ajustar para no máximo 15 minutos. Não há ensaio declarado por
  este documento.
- **Gravação e publicação:** gravação, edição e publicação (não listado, conforme
  planejamento citado no comentário de 03/11 da #353) ainda são pendentes; não
  há vídeo concluído ou publicação confirmada.
- Antes da captura, ocultar dados pessoais e remover tokens, senhas, CPFs,
  números de cartão, credenciais e URLs privadas de telas, terminais e artefatos.

## Referências

- [Especificação da issue #353](../../specs/353-video-script/spec.md)
- Issue [#341 — fluxo e preparação da demonstração](https://github.com/Async-And-Furious/async-furious-project/issues/341)
- Issue central: [#353 — Vídeo de Demonstração](https://github.com/Async-And-Furious/async-furious-project/issues/353)
- Issue relacionada: [#341 — roteiro/fluxos de demonstração](https://github.com/Async-And-Furious/async-furious-project/issues/341)
