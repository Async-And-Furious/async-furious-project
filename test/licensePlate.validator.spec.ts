import { describe, it, expect } from '@jest/globals';
import { LicensePlateValidator } from '../src/modules/veiculos/domain/validators/licensePlateValidator';

describe('LicensePlateValidator', () => {
  describe('isValid', () => {
    it('should return true for a traditional plate with hyphen (ABC-1234)', () => {
      expect(LicensePlateValidator.isValid('ABC-1234')).toBe(true);
    });

    it('should return true for a Mercosul format plate (ABC1D23)', () => {
      expect(LicensePlateValidator.isValid('ABC1D23')).toBe(true);
    });

    it('should return false for invalid plate formats', () => {
      expect(LicensePlateValidator.isValid('AB123-C')).toBe(false);
      expect(LicensePlateValidator.isValid('1234-ABC')).toBe(false);
      expect(LicensePlateValidator.isValid('ABC-12345')).toBe(false);
    });

    it('should be case-insensitive and validate correctly', () => {
      expect(LicensePlateValidator.isValid('abc1d23')).toBe(true);
    });

    it('should return false for empty or null values', () => {
      expect(LicensePlateValidator.isValid('')).toBe(false);
      expect(LicensePlateValidator.isValid(null as any)).toBe(false);
    });

    it('should return true for traditional plates without hyphen (ABC1234)', () => {
      expect(LicensePlateValidator.isValid('ABC1234')).toBe(true);
    });
  });
});

describe('LicensePlateValidator', () => {
  describe('isValid - Invalid Characters and Formats', () => {
    it('should return false if the plate contains special characters', () => {
      const invalidPlates = [
        'ABC-12@4', // @ no lugar de número
        'ABC#123', // Caractere especial no meio
        'ABC_123', // Underscore
        '!BC1234', // Símbolo no início
      ];

      invalidPlates.forEach((plate) => {
        const result = LicensePlateValidator.isValid(plate);
          if (result === true) {
            console.log(`❌ Failed for plate: "${plate}" - Should be false but returned true`);
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
        expect(LicensePlateValidator.isValid(plate)).toBe(false);
      });
    });

    it('should return false if plate contains non-latin characters', () => {
      // Teste para garantir que caracteres cirílicos ou acentuados falhem
      expect(LicensePlateValidator.isValid('ÁBC1234')).toBe(false);
      expect(LicensePlateValidator.isValid('АВС1234')).toBe(false); // 'A' cirílico
    });

    it('should return false for potential script injection attempts', () => {
      const injections = ['<script>', 'SELECT *', 'OR 1=1', '"{}"'];

      injections.forEach((attempt) => {
        expect(LicensePlateValidator.isValid(attempt)).toBe(false);
      });
    });
  });
});

describe('LicensePlateValidator - Length Validation', () => {
  describe('Minimum Length', () => {
    it.each([
      ['ABC123'], // 6 chars
      ['AB1234'], // 6 chars
      ['A'], // 1 char
      ['ABC-12'], // 5 chars effectively
    ])('should return false for length below 7 characters: %s', (input) => {
      expect(LicensePlateValidator.isValid(input)).toBe(false);
    });
  });

  describe('Excessive Length', () => {
    it.each([
      ['ABC12345'], // 8 chars
      ['ABC-12345'], // 8 chars effectively
      ['ABC123456789'], // Very long
      [' MERC-OSUL '], // Long with spaces
    ])('should return false for length above 7 characters: %s', (input) => {
      expect(LicensePlateValidator.isValid(input)).toBe(false);
    });
  });

  describe('Correct Length (Boundary)', () => {
    it('should return true for exactly 7 characters in valid format', () => {
      expect(LicensePlateValidator.isValid('ABC1234')).toBe(true);
      expect(LicensePlateValidator.isValid('ABC-1234')).toBe(true); // 7 chars + hyphen
    });
  });
});
