export class Cliente {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  tax_id: string;
  tax_id_type: 'CPF' | 'CNPJ';
  created_at: Date;
  updated_at: Date;
}
