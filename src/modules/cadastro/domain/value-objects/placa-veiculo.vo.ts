/**
 * Padrão Brasileiro (Tradicional e Mercosul):
 * - 3 letras iniciais
 * - 1 número
 * - 1 letra ou número (onde se diferencia o Mercosul)
 * - 2 números finais
 */
const BRAZILIAN_PLATE_PATTERN = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export class PlacaVeiculoVo {
  /**
   * Valida placas brasileiras garantindo integridade de formato e tamanho.
   * @param plate String da placa enviada pelo usuário ou sistema.
   */
  static isValid(plate: string | null | undefined): boolean {
    if (!plate || typeof plate !== 'string') {
      return false;
    }

    const sanitized = plate.replace(/[-\s]/g, '').toUpperCase();

    if (sanitized.length !== 7) {
      return false;
    }

    return BRAZILIAN_PLATE_PATTERN.test(sanitized);
  }
}
