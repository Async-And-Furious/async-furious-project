import { NotificacaoAdminStub } from '../../../src/modules/pecas-insumos/infrastructure/gateways/notificacao-admin.stub';

describe('NotificacaoAdminStub', () => {
  it('should resolve without throwing', async () => {
    const stub = new NotificacaoAdminStub();
    await expect(
      stub.alertar({ ordemServicoId: 'os-1', idsPecasIndisponiveis: ['peca-1', 'peca-2'] })
    ).resolves.toBeUndefined();
  });
});
