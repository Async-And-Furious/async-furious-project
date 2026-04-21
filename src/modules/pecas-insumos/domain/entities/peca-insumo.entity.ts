export class PecaInsumo {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  preco: number;
  quantidade_estoque: number;
  quantidade_minima: number;
  created_at: Date;
  updated_at: Date;
}
