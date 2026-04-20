/**
 * Padrão Brasileiro (Tradicional e Mercosul):
 * - 3 letras iniciais
 * - 1 número
 * - 1 letra ou número (onde se diferencia o Mercosul)
 * - 2 números finais
 */
const BRAZILIAN_PLATE_PATTERN = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export class LicensePlateValidator {
  /**
   * Valida placas brasileiras garantindo integridade de formato e tamanho.
   * @param plate String da placa enviada pelo usuário ou sistema.
   */
  static isValid(plate: string | null | undefined): boolean {
    // 1. Defesa Early-Return: Evita processar valores nulos ou vazios
    if (!plate || typeof plate !== 'string') {
      return false;
    }

    // 2. Normalização: Otimizada para remover apenas o que é estritamente necessário
    // Removemos hifens e espaços para focar no valor semântico
    const sanitized = plate.replace(/[-\s]/g, '').toUpperCase();

    // 3. Fail-Fast de Tamanho: Operação de custo O(1) antes da Regex
    if (sanitized.length !== 7) {
      return false;
    }

    // 4. Validação de Padrão: Executa a máquina de estados da Regex
    return BRAZILIAN_PLATE_PATTERN.test(sanitized);
  }
}
