import { describe, it, expect } from '@jest/globals';
import { DocumentValidator } from '../src/modules/clientes/domain/validators/document.validator';

describe('DocumentValidator', () => {
  describe('CPF Validation', () => {
    it('should validate a valid CPF', () => {
      // CPF válido: 123.456.789-09
      expect(DocumentValidator.isValidCpf('12345678909')).toBe(true);
      expect(DocumentValidator.isValidCpf('123.456.789-09')).toBe(true);
    });

    it('should invalidate CPF with wrong length', () => {
      expect(DocumentValidator.isValidCpf('123456789')).toBe(false); // 9 digits
      expect(DocumentValidator.isValidCpf('123456789012')).toBe(false); // 12 digits
    });

    it('should invalidate CPF with all same digits', () => {
      expect(DocumentValidator.isValidCpf('11111111111')).toBe(false);
      expect(DocumentValidator.isValidCpf('00000000000')).toBe(false);
    });

    it('should invalidate CPF with wrong check digits', () => {
      expect(DocumentValidator.isValidCpf('12345678900')).toBe(false);
      expect(DocumentValidator.isValidCpf('12345678901')).toBe(false);
    });

    it('should validate CPF with leading zeros', () => {
      // CPF válido com zeros: 529.982.247-25
      expect(DocumentValidator.isValidCpf('52998224725')).toBe(true);
      expect(DocumentValidator.isValidCpf('529.982.247-25')).toBe(true);
    });
  });

  describe('CNPJ Validation', () => {
    it('should validate a valid CNPJ', () => {
      // CNPJ válido: 11.222.333/0001-81
      expect(DocumentValidator.isValidCnpj('11222333000181')).toBe(true);
      expect(DocumentValidator.isValidCnpj('11.222.333/0001-81')).toBe(true);
    });

    it('should validate CNPJ alfanumérico (formato futuro)', () => {
      // Exemplo de CNPJ alfanumérico válido: AB12C3D4001E68
      expect(DocumentValidator.isValidCnpj('AB12C3D4001E68')).toBe(true);
      expect(DocumentValidator.isValidCnpj('AB.12C.3D4/001E-68')).toBe(true);
    });

    it('should invalidate CNPJ with wrong length', () => {
      expect(DocumentValidator.isValidCnpj('1122233300018')).toBe(false); // 13 digits
      expect(DocumentValidator.isValidCnpj('112223330001811')).toBe(false); // 15 digits
    });

    it('should invalidate CNPJ with all same digits', () => {
      expect(DocumentValidator.isValidCnpj('11111111111111')).toBe(false);
      expect(DocumentValidator.isValidCnpj('00000000000000')).toBe(false);
    });

    it('should invalidate CNPJ with wrong check digits', () => {
      expect(DocumentValidator.isValidCnpj('11222333000100')).toBe(false);
      expect(DocumentValidator.isValidCnpj('11222333000182')).toBe(false);
    });
  });

  describe('Document Validation', () => {
    it('should validate CPF using isValidDocument', () => {
      expect(DocumentValidator.isValidDocument('12345678909', 'CPF')).toBe(true);
      expect(DocumentValidator.isValidDocument('12345678900', 'CPF')).toBe(false);
    });

    it('should validate CNPJ using isValidDocument', () => {
      expect(DocumentValidator.isValidDocument('11222333000181', 'CNPJ')).toBe(true);
      expect(DocumentValidator.isValidDocument('11222333000100', 'CNPJ')).toBe(false);
    });

    it('should return false for invalid type', () => {
      expect(DocumentValidator.isValidDocument('12345678909', 'INVALID' as any)).toBe(false);
    });
  });

  describe('CPF Formatting', () => {
    it('should format valid CPF', () => {
      expect(DocumentValidator.formatCpf('12345678909')).toBe('123.456.789-09');
      expect(DocumentValidator.formatCpf('123.456.789-09')).toBe('123.456.789-09');
    });

    it('should return null for invalid CPF', () => {
      expect(DocumentValidator.formatCpf('12345678900')).toBe(null);
      expect(DocumentValidator.formatCpf('123456789')).toBe(null);
    });
  });

  describe('CNPJ Formatting', () => {
    it('should format valid CNPJ', () => {
      expect(DocumentValidator.formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
      expect(DocumentValidator.formatCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81');
    });

    it('should format CNPJ alfanumérico', () => {
      expect(DocumentValidator.formatCnpj('AB12C3D4001E68')).toBe('AB.12C.3D4/001E-68');
      expect(DocumentValidator.formatCnpj('ab12c3d4001e68')).toBe('AB.12C.3D4/001E-68'); // Deve converter para maiúsculo
    });

    it('should return null for invalid CNPJ', () => {
      expect(DocumentValidator.formatCnpj('11222333000100')).toBe(null);
      expect(DocumentValidator.formatCnpj('1122233300018')).toBe(null);
    });
  });

  describe('Document Utilities', () => {
    it('should unformat documents', () => {
      expect(DocumentValidator.unformatDocument('123.456.789-09')).toBe('12345678909');
      expect(DocumentValidator.unformatDocument('11.222.333/0001-81')).toBe('11222333000181');
      expect(DocumentValidator.unformatDocument('12345678909')).toBe('12345678909');
      expect(DocumentValidator.unformatDocument('AB.12C.3D4/001E-68')).toBe('AB12C3D4001E68');
      expect(DocumentValidator.unformatDocument('ab.12c.3d4/001e-68')).toBe('AB12C3D4001E68'); // Deve converter para maiúsculo
    });

    it('should detect document type', () => {
      expect(DocumentValidator.detectDocumentType('12345678909')).toBe('CPF');
      expect(DocumentValidator.detectDocumentType('123.456.789-09')).toBe('CPF');
      expect(DocumentValidator.detectDocumentType('11222333000181')).toBe('CNPJ');
      expect(DocumentValidator.detectDocumentType('11.222.333/0001-81')).toBe('CNPJ');
      expect(DocumentValidator.detectDocumentType('AB12C3D4001E68')).toBe('CNPJ'); // CNPJ alfanumérico
      expect(DocumentValidator.detectDocumentType('AB.12C.3D4/001E-68')).toBe('CNPJ');
      expect(DocumentValidator.detectDocumentType('123456789')).toBe(null);
      expect(DocumentValidator.detectDocumentType('112223330001811')).toBe(null);
    });
  });

  describe('Real World Examples', () => {
    it('should validate real CPF examples', () => {
      // Exemplos de CPFs válidos (dados fictícios para teste)
      expect(DocumentValidator.isValidCpf('52998224725')).toBe(true);
      expect(DocumentValidator.isValidCpf('12345678909')).toBe(true);
    });

    it('should validate real CNPJ examples', () => {
      // Exemplos de CNPJs válidos (dados fictícios para teste)
      expect(DocumentValidator.isValidCnpj('12345678000195')).toBe(true);
      expect(DocumentValidator.isValidCnpj('11222333000181')).toBe(true);
    });
  });
});
