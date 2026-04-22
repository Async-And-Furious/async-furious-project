export class Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  documento: string;
  tipo_documento: 'CPF' | 'CNPJ';
  created_at: Date;
  updated_at: Date;
}
