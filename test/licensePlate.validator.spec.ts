import { describe, it, expect } from '@jest/globals';
import { PlacaVeiculoVo } from '../src/modules/cadastro/domain/value-objects/placa-veiculo.vo';

describe('PlacaVeiculoVo', () => {
  describe('isValid', () => {
    it('should return true for a traditional plate with hyphen (ABC-1234)', () => {
      expect(PlacaVeiculoVo.isValid('ABC-1234')).toBe(true);
    });

    it('should return true for a Mercosul format plate (ABC1D23)', () => {
      expect(PlacaVeiculoVo.isValid('ABC1D23')).toBe(true);
    });

    it('should return false for invalid plate formats', () => {
      expect(PlacaVeiculoVo.isValid('AB123-C')).toBe(false);
      expect(PlacaVeiculoVo.isValid('1234-ABC')).toBe(false);
      expect(PlacaVeiculoVo.isValid('ABC-12345')).toBe(false);
    });

    it('should be case-insensitive and validate correctly', () => {
      expect(PlacaVeiculoVo.isValid('abc1d23')).toBe(true);
    });

    it('should return false for empty or null values', () => {
      expect(PlacaVeiculoVo.isValid('')).toBe(false);
      expect(PlacaVeiculoVo.isValid(null as unknown as string)).toBe(false);
    });

    it('should return true for traditional plates without hyphen (ABC1234)', () => {
      expect(PlacaVeiculoVo.isValid('ABC1234')).toBe(true);
    });
  });
});

describe('PlacaVeiculoVo', () => {
  describe('isValid - Invalid Characters and Formats', () => {
    it('should return false if the plate contains special characters', () => {
      const invalidPlates = [
        'ABC-12@4', // @ no lugar de número
        'ABC#123', // Caractere especial no meio
        'ABC_123', // Underscore
        '!BC1234', // Símbolo no início
      ];

      invalidPlates.forEach((plate) => {
        const result = PlacaVeiculoVo.isValid(plate);
        if (result === true) {
          process.stderr.write(
            `❌ Failed for plate: "${plate}" - Should be false but returned true`
          );
        }
        expect(result).toBe(false);
      });
    });

    it('should return false for plates with invalid lengths', () => {
      const wrongLengths = [
        'AB123', // Curta demais
        'ABCD1234', // Longa demais
        'ABC12345', // Longa demais (formato antigo)
        'A1B2C3D', // Formato totalmente aleatório
      ];

      wrongLengths.forEach((plate) => {
        expect(PlacaVeiculoVo.isValid(plate)).toBe(false);
      });
    });

    it('should return false if plate contains non-latin characters', () => {
      // Teste para garantir que caracteres cirílicos ou acentuados falhem
      expect(PlacaVeiculoVo.isValid('ÁBC1234')).toBe(false);
      expect(PlacaVeiculoVo.isValid('АВС1234')).toBe(false); // 'A' cirílico
    });

    it('should return false for potential script injection attempts', () => {
      const injections = ['<script>', 'SELECT *', 'OR 1=1', '"{}"'];

      injections.forEach((attempt) => {
        expect(PlacaVeiculoVo.isValid(attempt)).toBe(false);
      });
    });
  });
});

describe('PlacaVeiculoVo - Length Validation', () => {
  describe('Minimum Length', () => {
    it.each([
      ['ABC123'], // 6 chars
      ['AB1234'], // 6 chars
      ['A'], // 1 char
      ['ABC-12'], // 5 chars effectively
    ])('should return false for length below 7 characters: %s', (input) => {
      expect(PlacaVeiculoVo.isValid(input)).toBe(false);
    });
  });

  describe('Excessive Length', () => {
    it.each([
      ['ABC12345'], // 8 chars
      ['ABC-12345'], // 8 chars effectively
      ['ABC123456789'], // Very long
      [' MERC-OSUL '], // Long with spaces
    ])('should return false for length above 7 characters: %s', (input) => {
      expect(PlacaVeiculoVo.isValid(input)).toBe(false);
    });
  });

  describe('Correct Length (Boundary)', () => {
    it('should return true for exactly 7 characters in valid format', () => {
      expect(PlacaVeiculoVo.isValid('ABC1234')).toBe(true);
      expect(PlacaVeiculoVo.isValid('ABC-1234')).toBe(true); // 7 chars + hyphen
    });
  });
});
