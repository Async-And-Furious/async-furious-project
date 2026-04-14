export class OrdemDeServico {
  id: string;
  vehicle_id: string;
  customer_id: string;
  status:
    | 'RECEIVED'
    | 'UNDER_DIAGNOSIS'
    | 'AWAITING_APPROVAL'
    | 'IN_PROGRESS'
    | 'FINISHED'
    | 'DELIVERED';
  description: string | null;
  created_at: Date;
  updated_at: Date;
  delivered_at: Date | null;
}
