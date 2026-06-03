import { CpfCnpjVo } from '@/modules/cadastro/domain/value-objects/cpf-cnpj.vo';
import { DomainException } from '@/shared/domain/exceptions/domain.exception';

describe('CpfCnpjVo', () => {
  describe('criar', () => {
    describe('CPF válido', () => {
      it('deve criar CPF com números apenas', () => {
        const cpf = CpfCnpjVo.criar('11144477735', 'CPF');

        expect(cpf.valor).toBe('11144477735');
        expect(cpf.tipo).toBe('CPF');
      });

      it('deve criar CPF com formatação', () => {
        const cpf = CpfCnpjVo.criar('111.444.777-35', 'CPF');

        expect(cpf.valor).toBe('11144477735');
        expect(cpf.tipo).toBe('CPF');
      });

      it('deve formatar CPF corretamente', () => {
        const cpf = CpfCnpjVo.criar('11144477735', 'CPF');

        expect(cpf.formato).toBe('111.444.777-35');
      });
    });

    describe('CNPJ válido', () => {
      it('deve criar CNPJ com números apenas', () => {
        const cnpj = CpfCnpjVo.criar('11222333000181', 'CNPJ');

        expect(cnpj.valor).toBe('11222333000181');
        expect(cnpj.tipo).toBe('CNPJ');
      });

      it('deve criar CNPJ com formatação', () => {
        const cnpj = CpfCnpjVo.criar('11.222.333/0001-81', 'CNPJ');

        expect(cnpj.valor).toBe('11222333000181');
        expect(cnpj.tipo).toBe('CNPJ');
      });

      it('deve formatar CNPJ corretamente', () => {
        const cnpj = CpfCnpjVo.criar('11222333000181', 'CNPJ');

        expect(cnpj.formato).toBe('11.222.333/0001-81');
      });
    });

    describe('validações de entrada', () => {
      it.each([
        ['valor vazio', '', 'CPF'],
        ['valor null', null as never, 'CPF'],
        ['valor undefined', undefined as never, 'CPF'],
        ['tipo inválido', '11144477735', 'INVALID' as never],
        ['tipo null', '11144477735', null as never],
      ])('deve lançar erro para %s', (_label, value, tipo) => {
        expect(() => CpfCnpjVo.criar(value, tipo)).toThrow(
          new DomainException('Tipo de documento invalido')
        );
      });
    });

    describe('validações de CPF', () => {
      it.each([
        ['CPF inválido', '12345678901'],
        ['todos os dígitos iguais', '11111111111'],
        ['formato inválido', '123.456.789-00'],
      ])('deve lançar erro para CPF com %s', (_label, cpf) => {
        expect(() => CpfCnpjVo.criar(cpf, 'CPF')).toThrow(new DomainException('CPF invalido'));
      });
    });

    describe('validações de CNPJ', () => {
      it.each([
        ['CNPJ inválido', '12345678000100'],
        ['todos os dígitos iguais', '11111111111111'],
        ['formato inválido', '12.345.678/0001-00'],
      ])('deve lançar erro para CNPJ com %s', (_label, cnpj) => {
        expect(() => CpfCnpjVo.criar(cnpj, 'CNPJ')).toThrow(new DomainException('CNPJ invalido'));
      });
    });
  });

  describe('formatação', () => {
    describe('formatação de CPF', () => {
      it('deve formatar CPF com zeros à esquerda', () => {
        const cpf = CpfCnpjVo.criar('01234567890', 'CPF');

        expect(cpf.formato).toBe('012.345.678-90');
      });

      it('deve formatar CPF removendo caracteres especiais', () => {
        const cpf = CpfCnpjVo.criar('111@444#777$35', 'CPF');

        expect(cpf.formato).toBe('111.444.777-35');
      });
    });

    describe('formatação de CNPJ', () => {
      it('deve formatar CNPJ com zeros à esquerda', () => {
        const cnpj = CpfCnpjVo.criar('01234567000195', 'CNPJ');

        expect(cnpj.formato).toBe('01.234.567/0001-95');
      });

      it('deve formatar CNPJ removendo caracteres especiais', () => {
        const cnpj = CpfCnpjVo.criar('11@222#333$0001%81', 'CNPJ');

        expect(cnpj.formato).toBe('11.222.333/0001-81');
      });
    });
  });

  describe('equals', () => {
    it('deve retornar true para CPFs iguais', () => {
      const cpf1 = CpfCnpjVo.criar('11144477735', 'CPF');
      const cpf2 = CpfCnpjVo.criar('111.444.777-35', 'CPF');

      expect(cpf1.equals(cpf2)).toBe(true);
    });

    it('deve retornar true para CNPJs iguais', () => {
      const cnpj1 = CpfCnpjVo.criar('11222333000181', 'CNPJ');
      const cnpj2 = CpfCnpjVo.criar('11.222.333/0001-81', 'CNPJ');

      expect(cnpj1.equals(cnpj2)).toBe(true);
    });

    it('deve retornar false para valores diferentes', () => {
      const cpf1 = CpfCnpjVo.criar('11144477735', 'CPF');
      const cpf2 = CpfCnpjVo.criar('22255588846', 'CPF');

      expect(cpf1.equals(cpf2)).toBe(false);
    });

    it('deve retornar false para tipos diferentes', () => {
      const cpf = CpfCnpjVo.criar('11144477735', 'CPF');
      const cnpj = CpfCnpjVo.criar('11222333000181', 'CNPJ');

      expect(cpf.equals(cnpj)).toBe(false);
    });

    it('deve retornar false para valor igual mas tipo diferente', () => {
      const cpf = CpfCnpjVo.criar('11144477735', 'CPF');
      const cnpj = CpfCnpjVo.criar('11222333000181', 'CNPJ');

      expect(cpf.equals(cnpj)).toBe(false);
    });
  });

  describe('getters', () => {
    it('deve retornar valor sem formatação', () => {
      const cpf = CpfCnpjVo.criar('111.444.777-35', 'CPF');

      expect(cpf.valor).toBe('11144477735');
    });

    it('deve retornar tipo correto', () => {
      const cpf = CpfCnpjVo.criar('11144477735', 'CPF');
      const cnpj = CpfCnpjVo.criar('11222333000181', 'CNPJ');

      expect(cpf.tipo).toBe('CPF');
      expect(cnpj.tipo).toBe('CNPJ');
    });
  });

  describe('casos extremos', () => {
    it('deve processar CPF com espaços', () => {
      const cpf = CpfCnpjVo.criar(' 111 444 777 35 ', 'CPF');

      expect(cpf.valor).toBe('11144477735');
      expect(cpf.formato).toBe('111.444.777-35');
    });

    it('deve processar CNPJ com espaços', () => {
      const cnpj = CpfCnpjVo.criar(' 11 222 333 0001 81 ', 'CNPJ');

      expect(cnpj.valor).toBe('11222333000181');
      expect(cnpj.formato).toBe('11.222.333/0001-81');
    });

    it('deve processar documento com caracteres mistos', () => {
      const cpf = CpfCnpjVo.criar('111abc444def777ghi35', 'CPF');

      expect(cpf.valor).toBe('11144477735');
      expect(cpf.formato).toBe('111.444.777-35');
    });
  });
});
