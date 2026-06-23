import { FornecedorStub } from '../../../src/modules/pecas-insumos/infrastructure/gateways/fornecedor.stub';

describe('FornecedorStub', () => {
  it('should resolve without throwing', async () => {
    const stub = new FornecedorStub();
    await expect(
      stub.enviarPedido({
        pedidoId: 'ped-1',
        fornecedorId: 'forn-1',
        itens: [{ pecaId: 'peca-1', quantidadeSolicitada: 5 }],
      })
    ).resolves.toBeUndefined();
  });
});
