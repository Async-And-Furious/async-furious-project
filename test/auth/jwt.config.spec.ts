import { ConfigService } from '@nestjs/config';
import { createJwtModuleOptions, resolveJwtContract } from '../../src/auth/jwt.config';

function configWith(env: Record<string, string>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

const productionRs256 = {
  NODE_ENV: 'production',
  JWT_ALGORITHM: 'RS256',
  JWT_ISSUER: 'repo-auth-serverless',
  JWT_AUDIENCE: 'async-furious-project',
  JWT_EXPIRES_IN: '1800',
};

describe('createJwtModuleOptions', () => {
  it('uses the HS256 secret for local development', () => {
    const options = createJwtModuleOptions(configWith({ JWT_SECRET: 'local-secret' }));

    expect(options).toMatchObject({
      secret: 'local-secret',
      signOptions: {
        algorithm: 'HS256',
        issuer: 'repo-auth-serverless',
        audience: 'async-furious-project',
        expiresIn: 1800,
      },
    });
  });

  it('refuses HS256 signing without a secret', () => {
    expect(() => createJwtModuleOptions(configWith({}))).toThrow(
      'HS256 signing is local/test-only and requires JWT_SECRET'
    );
  });

  it('refuses production RS256 signing without the private key', () => {
    expect(() => createJwtModuleOptions(configWith(productionRs256))).toThrow(
      'Production RS256 signing requires JWT_PRIVATE_KEY'
    );
  });

  it('uses the private key for production RS256 signing', () => {
    const options = createJwtModuleOptions(
      configWith({ ...productionRs256, JWT_PRIVATE_KEY: 'pem-key' })
    );

    expect(options).toMatchObject({
      privateKey: 'pem-key',
      signOptions: { algorithm: 'RS256' },
    });
  });
});

describe('resolveJwtContract', () => {
  it('rejects production contracts that do not use RS256 with 1800 seconds', () => {
    expect(() =>
      resolveJwtContract(configWith({ ...productionRs256, JWT_EXPIRES_IN: '3600' }))
    ).toThrow('Production JWT requires RS256 and JWT_EXPIRES_IN=1800');
  });

  it('rejects an incomplete production contract', () => {
    expect(() => resolveJwtContract(configWith({ NODE_ENV: 'production' }))).toThrow(
      'JWT production contract is incomplete or invalid'
    );
  });
});
