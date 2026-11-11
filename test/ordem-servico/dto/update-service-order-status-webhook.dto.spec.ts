import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateServiceOrderStatusWebhookDto } from '../../../src/modules/ordem-servico/presentation/dto/update-service-order-status-webhook.dto';

const validar = (status: string) =>
  validate(
    plainToInstance(UpdateServiceOrderStatusWebhookDto, {
      osId: '123e4567-e89b-12d3-a456-426614174000',
      status,
    })
  );

describe('UpdateServiceOrderStatusWebhookDto', () => {
  it('rejeita DELIVERED: a entrega só passa por registrar-entrega', async () => {
    const erros = await validar('DELIVERED');
    expect(erros.map((e) => e.property)).toEqual(['status']);
  });

  it('aceita FINISHED', async () => {
    expect(await validar('FINISHED')).toHaveLength(0);
  });
});
