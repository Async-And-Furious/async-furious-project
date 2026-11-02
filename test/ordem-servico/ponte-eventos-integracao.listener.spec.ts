import { Logger } from '@nestjs/common';
import { PonteEventosIntegracaoListener } from '../../src/modules/ordem-servico/infrastructure/messaging/ponte-eventos-integracao.listener';
import type { IPublicadorIntegracao } from '../../src/shared/domain/interfaces/publicador-integracao.interface';
import { OrdemServicoRecebida } from '../../src/modules/ordem-servico/domain/events/ordem-servico-recebida.event';
import { OrcamentoCalculado } from '../../src/modules/ordem-servico/domain/events/orcamento-calculado.event';
import { EtapaDaSagaFalhou } from '../../src/modules/ordem-servico/domain/events/etapa-da-saga-falhou.event';

describe('PonteEventosIntegracaoListener', () => {
  let publicador: jest.Mocked<IPublicadorIntegracao>;
  let ponte: PonteEventosIntegracaoListener;

  beforeEach(() => {
    publicador = { publicar: jest.fn().mockResolvedValue(undefined) };
    ponte = new PonteEventosIntegracaoListener(publicador);
  });

  it('publica OrdemServicoRecebida e OrcamentoCalculado', async () => {
    const recebida = new OrdemServicoRecebida('os-1');
    const calculado = new OrcamentoCalculado('os-1', 100, 50, 150);

    await ponte.onOrdemServicoRecebida(recebida);
    await ponte.onOrcamentoCalculado(calculado);

    expect(publicador.publicar.mock.calls).toEqual([[recebida], [calculado]]);
  });

  it('publica EtapaDaSagaFalhou detectada pelo próprio OS Service', async () => {
    const falha = new EtapaDaSagaFalhou('os-service', 'ExecucaoConcluida', 'os-1', 'reparo', 'x');

    await ponte.onEtapaDaSagaFalhou(falha);

    expect(publicador.publicar).toHaveBeenCalledWith(falha);
  });

  it('não devolve ao broker uma EtapaDaSagaFalhou vinda de outro serviço', async () => {
    const deOutroServico = new EtapaDaSagaFalhou(
      'os-service',
      'OrcamentoCalculado',
      'os-1',
      'orcamento',
      'x'
    );
    (deOutroServico as { servicoOrigem: string }).servicoOrigem = 'billing-service';

    await ponte.onEtapaDaSagaFalhou(deOutroServico);

    expect(publicador.publicar).not.toHaveBeenCalled();
  });

  it('falha de publicação vai para o log e não propaga (sem outbox, ADR-0018)', async () => {
    publicador.publicar.mockRejectedValue(new Error('broker indisponível'));
    const erro = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const recebida = new OrdemServicoRecebida('os-1');

    await expect(ponte.onOrdemServicoRecebida(recebida)).resolves.toBeUndefined();

    expect(erro).toHaveBeenCalledWith(
      expect.stringContaining(`OrdemServicoRecebida da OS os-1 (eventId ${recebida.eventId})`)
    );
    erro.mockRestore();
  });
});
