import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrcamentoRepository } from '@/modules/ordem-servico/infrastructure/repositories/orcamento.repository';
import { PrismaService } from '@/shared/infrastructure/database/prisma.service';

describe('OrcamentoRepository', () => {
  let repository: OrcamentoRepository;
  let orcamento: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };

  const mockOrcamento = {
    id: 'orc-123',
    id_ordem_servico: 'os-456',
    valor_total_servicos: 300.0,
    valor_total_pecas: 200.0,
    valor_total_geral: 500.0,
    status: 'PENDING',
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15'),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      orcamento: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrcamentoRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<OrcamentoRepository>(OrcamentoRepository);
    orcamento = module.get<PrismaService>(PrismaService).orcamento as unknown as typeof orcamento;
  });

  describe('create', () => {
    it('deve criar um novo orçamento', async () => {
      const createData = {
        id_ordem_servico: 'os-456',
        valor_total_servicos: 300.0,
        valor_total_pecas: 200.0,
        valor_total_geral: 500.0,
      };

      orcamento.create.mockResolvedValue(mockOrcamento);

      const result = await repository.create(createData);

      expect(orcamento.create).toHaveBeenCalledWith({ data: createData });
      expect(result).toEqual(mockOrcamento);
    });

    it('deve criar orçamento com valores zero', async () => {
      const createData = {
        id_ordem_servico: 'os-456',
        valor_total_servicos: 0,
        valor_total_pecas: 0,
        valor_total_geral: 0,
      };

      const orcamentoZero = { ...mockOrcamento, ...createData };
      orcamento.create.mockResolvedValue(orcamentoZero);

      const result = await repository.create(createData);

      expect(orcamento.create).toHaveBeenCalledWith({ data: createData });
      expect(result).toEqual(orcamentoZero);
    });

    it('deve criar orçamento com valores decimais', async () => {
      const createData = {
        id_ordem_servico: 'os-456',
        valor_total_servicos: 123.45,
        valor_total_pecas: 67.89,
        valor_total_geral: 191.34,
      };

      const orcamentoDecimal = { ...mockOrcamento, ...createData };
      orcamento.create.mockResolvedValue(orcamentoDecimal);

      const result = await repository.create(createData);

      expect(orcamento.create).toHaveBeenCalledWith({ data: createData });
      expect(result).toEqual(orcamentoDecimal);
    });
  });

  describe('findByOrdemServicoId', () => {
    it('deve retornar orçamento por ID da ordem de serviço', async () => {
      const idOrdemServico = 'os-456';
      orcamento.findUnique.mockResolvedValue(mockOrcamento);

      const result = await repository.findByOrdemServicoId(idOrdemServico);

      expect(orcamento.findUnique).toHaveBeenCalledWith({
        where: { id_ordem_servico: idOrdemServico },
      });
      expect(result).toEqual(mockOrcamento);
    });

    it('deve retornar null quando orçamento não encontrado', async () => {
      const idOrdemServico = 'os-inexistente';
      orcamento.findUnique.mockResolvedValue(null);

      const result = await repository.findByOrdemServicoId(idOrdemServico);

      expect(orcamento.findUnique).toHaveBeenCalledWith({
        where: { id_ordem_servico: idOrdemServico },
      });
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('deve atualizar um orçamento existente', async () => {
      const id = 'orc-123';
      const updateData = {
        valor_total_servicos: 400.0,
        valor_total_pecas: 300.0,
        valor_total_geral: 700.0,
        status: 'APPROVED' as const,
      };
      const updatedOrcamento = { ...mockOrcamento, ...updateData };

      orcamento.findUnique.mockResolvedValue(mockOrcamento);
      orcamento.update.mockResolvedValue(updatedOrcamento);

      const result = await repository.update(id, updateData);

      expect(orcamento.findUnique).toHaveBeenCalledWith({ where: { id } });
      expect(orcamento.update).toHaveBeenCalledWith({ where: { id }, data: updateData });
      expect(result).toEqual(updatedOrcamento);
    });

    it('deve atualizar apenas o status do orçamento', async () => {
      const id = 'orc-123';
      const updateData = { status: 'REJECTED' as const };
      const updatedOrcamento = { ...mockOrcamento, status: 'REJECTED' };

      orcamento.findUnique.mockResolvedValue(mockOrcamento);
      orcamento.update.mockResolvedValue(updatedOrcamento);

      const result = await repository.update(id, updateData);

      expect(orcamento.update).toHaveBeenCalledWith({ where: { id }, data: updateData });
      expect(result).toEqual(updatedOrcamento);
    });

    it('deve atualizar apenas valores monetários', async () => {
      const id = 'orc-123';
      const updateData = { valor_total_servicos: 250.0, valor_total_geral: 450.0 };
      const updatedOrcamento = { ...mockOrcamento, ...updateData };

      orcamento.findUnique.mockResolvedValue(mockOrcamento);
      orcamento.update.mockResolvedValue(updatedOrcamento);

      const result = await repository.update(id, updateData);

      expect(orcamento.update).toHaveBeenCalledWith({ where: { id }, data: updateData });
      expect(result).toEqual(updatedOrcamento);
    });

    it('deve lançar NotFoundException quando orçamento não encontrado', async () => {
      const id = 'orc-inexistente';
      const updateData = { status: 'APPROVED' as const };

      orcamento.findUnique.mockResolvedValue(null);

      await expect(repository.update(id, updateData)).rejects.toThrow(
        new NotFoundException(`Orçamento com ID ${id} não encontrado`)
      );

      expect(orcamento.findUnique).toHaveBeenCalledWith({ where: { id } });
      expect(orcamento.update).not.toHaveBeenCalled();
    });
  });

  describe('Cenários de integração', () => {
    it('deve criar e depois buscar orçamento por ordem de serviço', async () => {
      const createData = {
        id_ordem_servico: 'os-789',
        valor_total_servicos: 150.0,
        valor_total_pecas: 100.0,
        valor_total_geral: 250.0,
      };

      const novoOrcamento = { ...mockOrcamento, ...createData };

      orcamento.create.mockResolvedValue(novoOrcamento);
      const created = await repository.create(createData);

      orcamento.findUnique.mockResolvedValue(novoOrcamento);
      const found = await repository.findByOrdemServicoId(createData.id_ordem_servico);

      expect(created).toEqual(novoOrcamento);
      expect(found).toEqual(novoOrcamento);
    });

    it('deve criar, atualizar e verificar mudanças', async () => {
      const createData = {
        id_ordem_servico: 'os-999',
        valor_total_servicos: 100.0,
        valor_total_pecas: 50.0,
        valor_total_geral: 150.0,
      };

      const orcamentoCriado = { ...mockOrcamento, ...createData };
      const updateData = { status: 'APPROVED' as const };
      const orcamentoAtualizado = { ...orcamentoCriado, ...updateData };

      orcamento.create.mockResolvedValue(orcamentoCriado);
      const created = await repository.create(createData);

      orcamento.findUnique.mockResolvedValue(orcamentoCriado);
      orcamento.update.mockResolvedValue(orcamentoAtualizado);
      const updated = await repository.update(created.id, updateData);

      expect(created.status).toBe('PENDING');
      expect(updated.status).toBe('APPROVED');
    });
  });
});
