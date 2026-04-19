/**
 * Validador de documentos brasileiros (CPF e CNPJ)
 * Implementa algoritmos oficiais de validação seguindo regras da Receita Federal
 */
export class DocumentValidator {
  /**
   * Valida se um CPF é válido
   * @param cpf - CPF a ser validado (apenas números ou formatado)
   * @returns true se válido, false caso contrário
   */
  static isValidCpf(cpf: string): boolean {
    // Remove caracteres não numéricos
    const cleanCpf = cpf.replace(/\D/g, '');

    // CPF deve ter exatamente 11 dígitos
    if (cleanCpf.length !== 11) {
      return false;
    }

    // Verifica se todos os dígitos são iguais (CPF inválido)
    if (/^(\d)\1{10}$/.test(cleanCpf)) {
      return false;
    }

    // Calcula primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    const firstDigit = remainder === 10 ? 0 : remainder;

    // Verifica primeiro dígito
    if (firstDigit !== parseInt(cleanCpf.charAt(9))) {
      return false;
    }

    // Calcula segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    const secondDigit = remainder === 10 ? 0 : remainder;

    // Verifica segundo dígito
    return secondDigit === parseInt(cleanCpf.charAt(10));
  }

  /**
   * Valida se um CNPJ é válido (suporta formato numérico atual e alfanumérico futuro)
   * @param cnpj - CNPJ a ser validado (apenas números ou alfanumérico)
   * @returns true se válido, false caso contrário
   */
  static isValidCnpj(cnpj: string): boolean {
    // Remove caracteres não alfanuméricos
    const cleanCnpj = cnpj.replace(/[^A-Z0-9]/gi, '').toUpperCase();

    // CNPJ deve ter exatamente 14 caracteres (8 raiz + 4 filial + 2 DV)
    if (cleanCnpj.length !== 14) {
      return false;
    }

    // Verifica se todos os dígitos são iguais (CNPJ inválido)
    if (/^(.)\1{13}$/.test(cleanCnpj)) {
      return false;
    }

    // Função auxiliar para converter alfanumérico para numérico
    const charToNumber = (char: string): number => {
      if (/[0-9]/.test(char)) {
        return parseInt(char);
      } else if (/[A-Z]/.test(char)) {
        return char.charCodeAt(0) - 55; // A=10, B=11, ..., Z=35
      }
      return 0;
    };

    // Calcula primeiro dígito verificador
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += charToNumber(cleanCnpj.charAt(i)) * weights1[i];
    }
    let remainder = sum % 11;
    const firstDigit = remainder < 2 ? 0 : 11 - remainder;

    // Verifica primeiro dígito (sempre numérico)
    if (firstDigit !== parseInt(cleanCnpj.charAt(12))) {
      return false;
    }

    // Calcula segundo dígito verificador
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += charToNumber(cleanCnpj.charAt(i)) * weights2[i];
    }
    remainder = sum % 11;
    const secondDigit = remainder < 2 ? 0 : 11 - remainder;

    // Verifica segundo dígito (sempre numérico)
    return secondDigit === parseInt(cleanCnpj.charAt(13));
  }

  /**
   * Valida documento baseado no tipo
   * @param document - Documento (CPF ou CNPJ)
   * @param type - Tipo do documento ('CPF' ou 'CNPJ')
   * @returns true se válido, false caso contrário
   */
  static isValidDocument(document: string, type: 'CPF' | 'CNPJ'): boolean {
    switch (type) {
      case 'CPF':
        return this.isValidCpf(document);
      case 'CNPJ':
        return this.isValidCnpj(document);
      default:
        return false;
    }
  }

  /**
   * Formata CPF no padrão brasileiro (XXX.XXX.XXX-XX)
   * @param cpf - CPF com ou sem formatação
   * @returns CPF formatado ou null se inválido
   */
  static formatCpf(cpf: string): string | null {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (!this.isValidCpf(cleanCpf)) {
      return null;
    }
    return cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Formata CNPJ no padrão brasileiro (XX.XXX.XXX/XXXX-XX)
   * Suporta formato alfanumérico
   * @param cnpj - CNPJ com ou sem formatação
   * @returns CNPJ formatado ou null se inválido
   */
  static formatCnpj(cnpj: string): string | null {
    const cleanCnpj = cnpj.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (!this.isValidCnpj(cleanCnpj)) {
      return null;
    }
    // Formato: XX.XXX.XXX/XXXX-XX
    return cleanCnpj.replace(/(.{2})(.{3})(.{3})(.{4})(.{2})/, '$1.$2.$3/$4-$5');
  }

  /**
   * Remove formatação de documento
   * @param document - Documento formatado ou não
   * @returns Documento apenas com caracteres alfanuméricos maiúsculos
   */
  static unformatDocument(document: string): string {
    return document.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  }

  /**
   * Detecta automaticamente se é CPF ou CNPJ baseado no tamanho
   * @param document - Documento
   * @returns 'CPF', 'CNPJ' ou null se tamanho inválido
   */
  static detectDocumentType(document: string): 'CPF' | 'CNPJ' | null {
    const cleanDocument = this.unformatDocument(document);
    if (cleanDocument.length === 11) {
      return 'CPF';
    }
    if (cleanDocument.length === 14) {
      return 'CNPJ';
    }
    return null;
  }
}
