import { ConfigService } from '@nestjs/config';
import { createJwtModuleOptions, resolveJwtContract } from './jwt.config';

const config = (values: Record<string, string>): ConfigService =>
  ({ get: jest.fn((key: string) => values[key]) }) as unknown as ConfigService;

describe('JWT production contract', () => {
  it('configures RS256 signing with the explicit private key and shared claims', () => {
    const options = createJwtModuleOptions(
      config({
        NODE_ENV: 'production',
        JWT_ALGORITHM: 'RS256',
        JWT_PRIVATE_KEY: 'private-key',
        JWT_ISSUER: 'repo-auth-serverless',
        JWT_AUDIENCE: 'async-furious-project',
        JWT_EXPIRES_IN: '1800',
      })
    );
    expect(options).toMatchObject({
      privateKey: 'private-key',
      signOptions: {
        algorithm: 'RS256',
        expiresIn: 1800,
        issuer: 'repo-auth-serverless',
        audience: 'async-furious-project',
      },
    });
  });

  it('fails closed when production RS256 configuration is incomplete', () => {
    expect(() =>
      createJwtModuleOptions(
        config({
          NODE_ENV: 'production',
          JWT_ALGORITHM: 'RS256',
          JWT_ISSUER: 'repo-auth-serverless',
          JWT_AUDIENCE: 'async-furious-project',
          JWT_EXPIRES_IN: '1800',
        })
      )
    ).toThrow('JWT_PRIVATE_KEY');
  });

  it('keeps HS256 fallback local-only', () => {
    expect(resolveJwtContract(config({ JWT_SECRET: 'local-secret' })).algorithm).toBe('HS256');
    expect(() =>
      resolveJwtContract(
        config({
          NODE_ENV: 'production',
          JWT_ALGORITHM: 'HS256',
          JWT_ISSUER: 'repo-auth-serverless',
          JWT_AUDIENCE: 'async-furious-project',
          JWT_EXPIRES_IN: '1800',
        })
      )
    ).toThrow();
  });
});
