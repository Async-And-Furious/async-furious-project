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
      it('deve lançar erro para valor vazio', () => {
        expect(() => CpfCnpjVo.criar('', 'CPF')).toThrow(
          new DomainException('Tipo de documento invalido')
        );
      });

      it('deve lançar erro para valor null', () => {
        expect(() => CpfCnpjVo.criar(null as unknown as string, 'CPF')).toThrow(
          new DomainException('Tipo de documento invalido')
        );
      });

      it('deve lançar erro para valor undefined', () => {
        expect(() => CpfCnpjVo.criar(undefined as unknown as string, 'CPF')).toThrow(
          new DomainException('Tipo de documento invalido')
        );
      });

      it('deve lançar erro para tipo inválido', () => {
        expect(() => CpfCnpjVo.criar('11144477735', 'INVALID' as any)).toThrow(
          new DomainException('Tipo de documento invalido')
        );
      });

      it('deve lançar erro para tipo null', () => {
        expect(() => CpfCnpjVo.criar('11144477735', null as any)).toThrow(
          new DomainException('Tipo de documento invalido')
        );
      });
    });

    describe('validações de CPF', () => {
      it('deve lançar erro para CPF inválido', () => {
        expect(() => CpfCnpjVo.criar('12345678901', 'CPF')).toThrow(
          new DomainException('CPF invalido')
        );
      });

      it('deve lançar erro para CPF com todos os dígitos iguais', () => {
        expect(() => CpfCnpjVo.criar('11111111111', 'CPF')).toThrow(
          new DomainException('CPF invalido')
        );
      });

      it('deve lançar erro para CPF com formato inválido', () => {
        expect(() => CpfCnpjVo.criar('123.456.789-00', 'CPF')).toThrow(
          new DomainException('CPF invalido')
        );
      });
    });

    describe('validações de CNPJ', () => {
      it('deve lançar erro para CNPJ inválido', () => {
        expect(() => CpfCnpjVo.criar('12345678000100', 'CNPJ')).toThrow(
          new DomainException('CNPJ invalido')
        );
      });

      it('deve lançar erro para CNPJ com todos os dígitos iguais', () => {
        expect(() => CpfCnpjVo.criar('11111111111111', 'CNPJ')).toThrow(
          new DomainException('CNPJ invalido')
        );
      });

      it('deve lançar erro para CNPJ com formato inválido', () => {
        expect(() => CpfCnpjVo.criar('12.345.678/0001-00', 'CNPJ')).toThrow(
          new DomainException('CNPJ invalido')
        );
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
      // Usando um número que poderia ser válido para ambos os tipos
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
