import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateServiceOrderStatusWebhookDto } from '../../../src/modules/ordem-servico/presentation/dto/update-service-order-status-webhook.dto';

const OS_ID = '123e4567-e89b-12d3-a456-426614174000';

async function errosDoStatus(status: string): Promise<string[]> {
  const dto = plainToInstance(UpdateServiceOrderStatusWebhookDto, { osId: OS_ID, status });
  const erros = await validate(dto);
  return erros.filter((erro) => erro.property === 'status').map((erro) => erro.property);
}

describe('UpdateServiceOrderStatusWebhookDto', () => {
  it('aceita um status de reprocesso permitido', async () => {
    await expect(errosDoStatus('UNDER_DIAGNOSIS')).resolves.toEqual([]);
  });

  it('rejeita DELIVERED na validação, antes do use case', async () => {
    await expect(errosDoStatus('DELIVERED')).resolves.toEqual(['status']);
  });
});
