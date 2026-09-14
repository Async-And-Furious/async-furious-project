import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookAuthGuard } from '../../src/auth/guards/webhook-auth.guard';

function contextWithHeader(value?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ header: () => value }) }),
  } as unknown as ExecutionContext;
}

describe('WebhookAuthGuard', () => {
  it('accepts the configured secret from x-webhook-secret', () => {
    const config = { get: () => 'test-webhook-secret' } as unknown as ConfigService;
    expect(new WebhookAuthGuard(config).canActivate(contextWithHeader('test-webhook-secret'))).toBe(true);
  });

  it('rejects a missing or different secret', () => {
    const config = { get: () => 'test-webhook-secret' } as unknown as ConfigService;
    const guard = new WebhookAuthGuard(config);
    expect(() => guard.canActivate(contextWithHeader())).toThrow();
    expect(() => guard.canActivate(contextWithHeader('wrong-secret'))).toThrow();
  });
});
