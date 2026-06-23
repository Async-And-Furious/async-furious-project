import { NotificacaoClienteStub } from '../../../src/modules/ordem-servico/infrastructure/gateways/notificacao-cliente.stub';

describe('NotificacaoClienteStub', () => {
  it('should resolve without throwing', async () => {
    const stub = new NotificacaoClienteStub();
    await expect(
      stub.notificar({ ordemServicoId: 'os-1', mensagem: 'Diagnóstico iniciado.' })
    ).resolves.toBeUndefined();
  });
});
