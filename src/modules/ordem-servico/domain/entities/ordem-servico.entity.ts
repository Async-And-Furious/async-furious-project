export class OrdemDeServico {
  id: string;
  id_veiculo: string;
  id_cliente: string;
  status:
    | 'RECEIVED'
    | 'UNDER_DIAGNOSIS'
    | 'AWAITING_APPROVAL'
    | 'IN_PROGRESS'
    | 'FINISHED'
    | 'DELIVERED';
  descricao: string | null;
  created_at: Date;
  updated_at: Date;
  entregue_em: Date | null;
}
