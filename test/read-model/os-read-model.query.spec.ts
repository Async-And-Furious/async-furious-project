import {
  decodeFilaCursor,
  encodeFilaCursor,
  OsReadModelQuery,
} from '../../src/modules/ordem-servico/infrastructure/read-model/os-read-model.query';
import { DomainException } from '../../src/shared/domain/exceptions/domain.exception';
import type { Db } from 'mongodb';

function doc(id: string, prioridade: number, createdAt: string) {
  const created = new Date(createdAt);
  return {
    _id: id,
    status: 'RECEIVED',
    descricao: null,
    prioridade,
    createdAt: created,
    updatedAt: created,
    marcos: { createdAt: created, iniciadaEm: null, finalizadaEm: null, entregueEm: null },
    cliente: { id: 'cli-1', nome: 'Maria', documento: '52998224725' },
    veiculo: { id: 'vei-1', placa: 'ABC1D23', marca: 'Honda', modelo: 'Fit' },
  };
}

describe('OsReadModelQuery', () => {
  let cursor: { sort: jest.Mock; limit: jest.Mock; toArray: jest.Mock };
  let collection: { find: jest.Mock; findOne: jest.Mock };
  let query: OsReadModelQuery;

  beforeEach(() => {
    cursor = { sort: jest.fn(), limit: jest.fn(), toArray: jest.fn().mockResolvedValue([]) };
    cursor.sort.mockReturnValue(cursor);
    cursor.limit.mockReturnValue(cursor);
    collection = { find: jest.fn(() => cursor), findOne: jest.fn() };
    query = new OsReadModelQuery({ collection: jest.fn(() => collection) } as unknown as Db);
  });

  describe('listarFila', () => {
    it('filtra os status fora da fila e ordena pelo índice composto', async () => {
      await query.listarFila(10);

      expect(collection.find).toHaveBeenCalledWith({
        status: { $nin: ['FINISHED', 'DELIVERED', 'CLOSED_WITHOUT_EXECUTION'] },
      });
      expect(cursor.sort).toHaveBeenCalledWith({ prioridade: 1, createdAt: 1, _id: 1 });
      expect(cursor.limit).toHaveBeenCalledWith(11);
    });

    it('devolve nextCursor do último item quando há mais páginas', async () => {
      const docs = [
        doc('a', 1, '2026-01-01T00:00:00Z'),
        doc('b', 2, '2026-01-01T00:00:00Z'),
        doc('c', 3, '2026-01-01T00:00:00Z'),
      ];
      cursor.toArray.mockResolvedValue(docs);

      const pagina = await query.listarFila(2);

      expect(pagina.data.map((os) => os.id)).toEqual(['a', 'b']);
      expect(pagina.pagination).toEqual({ limit: 2, nextCursor: encodeFilaCursor(docs[1]) });
      expect(pagina.data[0]).toEqual(
        expect.objectContaining({ clienteId: 'cli-1', veiculoId: 'vei-1', status: 'RECEIVED' })
      );
      expect(pagina.data[0]).not.toHaveProperty('orcamento');
    });

    it('não devolve cursor na última página', async () => {
      cursor.toArray.mockResolvedValue([doc('a', 1, '2026-01-01T00:00:00Z')]);

      const pagina = await query.listarFila(2);

      expect(pagina.pagination.nextCursor).toBeNull();
    });

    it('continua depois do último documento da página anterior (keyset)', async () => {
      const ultimo = doc('b', 2, '2026-01-01T12:00:00Z');

      await query.listarFila(10, encodeFilaCursor(ultimo));

      expect(collection.find).toHaveBeenCalledWith({
        status: { $nin: ['FINISHED', 'DELIVERED', 'CLOSED_WITHOUT_EXECUTION'] },
        $or: [
          { prioridade: { $gt: 2 } },
          { prioridade: 2, createdAt: { $gt: ultimo.createdAt } },
          { prioridade: 2, createdAt: ultimo.createdAt, _id: { $gt: 'b' } },
        ],
      });
    });
  });

  describe('cursor', () => {
    it('ida e volta preservam prioridade, createdAt e id', () => {
      const ultimo = doc('os-9', 4, '2026-03-04T05:06:07.000Z');

      expect(decodeFilaCursor(encodeFilaCursor(ultimo))).toEqual({
        prioridade: 4,
        createdAt: ultimo.createdAt,
        id: 'os-9',
      });
    });

    it.each(['nao-e-base64', Buffer.from('{"p":"x"}').toString('base64url')])(
      'rejeita cursor inválido (%s)',
      (invalido) => {
        expect(() => decodeFilaCursor(invalido)).toThrow(DomainException);
      }
    );
  });

  describe('detalhar e consultarStatus', () => {
    it('detalhar mapeia o documento para a visão de leitura', async () => {
      collection.findOne.mockResolvedValue(doc('os-1', 4, '2026-01-01T00:00:00Z'));

      const os = await query.detalhar('os-1');

      expect(collection.findOne).toHaveBeenCalledWith({ _id: 'os-1' });
      expect(os).toEqual(
        expect.objectContaining({
          id: 'os-1',
          created_at: new Date('2026-01-01T00:00:00Z'),
          cliente: { id: 'cli-1', nome: 'Maria', documento: '52998224725' },
        })
      );
    });

    it('consultarStatus projeta só status e marcos (sem dados de cliente)', async () => {
      const d = doc('os-1', 4, '2026-01-01T00:00:00Z');
      collection.findOne.mockResolvedValue(d);

      const status = await query.consultarStatus('os-1');

      expect(collection.findOne).toHaveBeenCalledWith(
        { _id: 'os-1' },
        { projection: { status: 1, marcos: 1 } }
      );
      expect(status).toEqual({ ordemServicoId: 'os-1', status: 'RECEIVED', marcos: d.marcos });
    });

    it('devolve null quando não há documento', async () => {
      collection.findOne.mockResolvedValue(null);

      await expect(query.detalhar('x')).resolves.toBeNull();
      await expect(query.consultarStatus('x')).resolves.toBeNull();
    });
  });
});
