import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Roda o script real (scripts/eks_endpoint_update.sh) contra um `aws` falso com estado.
const SCRIPT = join(__dirname, '../../scripts/eks_endpoint_update.sh');
const FAKE_AWS = join(__dirname, 'fake-aws.py');

const ADMIN = '10.0.0.1/32';
const OS = '2.2.2.2/32';
const BILLING = '1.1.1.1/32';
const TODOS = '0.0.0.0/0';

type Config = {
  endpointPrivateAccess: boolean;
  endpointPublicAccess: boolean;
  publicAccessCidrs: string[];
};
const config = (publico: boolean, cidrs: string[]): Config => ({
  endpointPrivateAccess: true,
  endpointPublicAccess: publico,
  publicAccessCidrs: cidrs,
});
const PRIVADO = config(false, [TODOS]);

type Cenario = {
  config?: Config;
  missing?: boolean;
  update_errors?: string[];
  update_status?: string;
  after_update?: Config[];
};

function rodar(args: string[], cenario: Cenario, original?: Config) {
  const dir = mkdtempSync(join(tmpdir(), 'eks-update-'));
  try {
    const estado = join(dir, 'state.json');
    const log = join(dir, 'calls.log');
    writeFileSync(estado, JSON.stringify(cenario));
    writeFileSync(log, '');
    const aws = join(dir, 'aws');
    writeFileSync(aws, `#!/bin/sh\nexec python3 "${FAKE_AWS}" "$@"\n`);
    chmodSync(aws, 0o755);
    const argumentos = [...args];
    if (original) {
      const arquivo = join(dir, 'original.json');
      writeFileSync(arquivo, JSON.stringify(original));
      argumentos.splice(1, 0, arquivo);
    }
    const r = spawnSync('bash', [SCRIPT, ...argumentos], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        AWS_REGION: 'us-east-2',
        EKS_CLUSTER_NAME: 'tc3-eks-hml',
        EKS_ENDPOINT_POLL_SECONDS: '0',
        EKS_ENDPOINT_TIMEOUT: '30',
        FAKE_AWS_STATE: estado,
        FAKE_AWS_LOG: log,
      },
    });
    const final = JSON.parse(readFileSync(estado, 'utf8')) as Cenario & {
      applied?: string[];
    };
    return {
      status: r.status,
      stderr: r.stderr,
      config: final.config,
      aplicados: final.applied ?? [],
      chamadas: readFileSync(log, 'utf8').trim().split('\n'),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const abrir = (cenario: Cenario) => rodar(['open', OS], cenario);
const restaurar = (original: Config, cenario: Cenario) => rodar(['restore', OS], cenario, original);

describe('eks_endpoint_update.sh open', () => {
  it('acrescenta o runner e confere a lista depois do update', () => {
    const r = abrir({ config: config(true, [ADMIN]) });

    expect(r.status).toBe(0);
    expect(r.config).toEqual(config(true, [ADMIN, OS]));
    expect(r.aplicados).toHaveLength(1);
  });

  it('espera o cluster ACTIVE antes de cada leitura', () => {
    const r = abrir({ config: config(true, [ADMIN]) });

    r.chamadas.forEach((chamada, i) => {
      if (chamada === 'eks describe-cluster') expect(r.chamadas[i - 1]).toBe('eks wait');
    });
  });

  it('ResourceInUseException: tenta de novo recalculando a partir da configuração atual', () => {
    const r = abrir({
      config: config(true, [ADMIN, BILLING]),
      update_errors: ['ResourceInUseException'],
    });

    expect(r.status).toBe(0);
    expect(r.aplicados).toEqual([
      `endpointPrivateAccess=true,endpointPublicAccess=true,publicAccessCidrs=${ADMIN},${BILLING},${OS}`,
    ]);
  });

  it('outro deploy sobrescreve logo depois do update: reaplica até o /32 estar na lista', () => {
    // O CI do repo-k8s-infra grava só o runner dele por cima da nossa abertura.
    const r = abrir({ config: config(true, [ADMIN]), after_update: [config(true, [BILLING])] });

    expect(r.status).toBe(0);
    expect(r.config).toEqual(config(true, [BILLING, OS]));
    expect(r.aplicados).toHaveLength(2);
  });

  it('runner já liberado: não chama o update', () => {
    const r = abrir({ config: config(true, [ADMIN, OS]) });

    expect(r.status).toBe(0);
    expect(r.aplicados).toEqual([]);
  });

  it('update que termina Failed falha o passo', () => {
    const r = abrir({ config: config(true, [ADMIN]), update_status: 'Failed' });

    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Failed');
  });

  it('erro que não é ResourceInUseException falha na hora', () => {
    const r = abrir({
      config: config(true, [ADMIN]),
      update_errors: ['InvalidParameterException'],
    });

    expect(r.status).toBe(1);
    expect(r.aplicados).toEqual([]);
  });
});

describe('eks_endpoint_update.sh restore', () => {
  it('tira só o /32 deste run e mantém o de outro deploy', () => {
    const r = restaurar(config(true, [ADMIN]), { config: config(true, [ADMIN, OS, BILLING]) });

    expect(r.status).toBe(0);
    expect(r.config).toEqual(config(true, [ADMIN, BILLING]));
  });

  it('o /32 volta por um update concorrente: remove de novo até sair', () => {
    const r = restaurar(config(true, [ADMIN]), {
      config: config(true, [ADMIN, OS]),
      after_update: [config(true, [ADMIN, OS])],
    });

    expect(r.status).toBe(0);
    expect(r.config).toEqual(config(true, [ADMIN]));
    expect(r.aplicados).toHaveLength(2);
  });

  it('endpoint já privado: não religa o acesso público', () => {
    const r = restaurar(config(true, [ADMIN]), { config: PRIVADO });

    expect(r.status).toBe(0);
    expect(r.aplicados).toEqual([]);
    expect(r.config).toEqual(PRIVADO);
  });

  it('cluster inexistente: nada a restaurar, sai com 0', () => {
    const r = restaurar(config(true, [ADMIN]), { missing: true });

    expect(r.status).toBe(0);
  });

  it('argumentos errados: sai com 2', () => {
    expect(rodar(['restore', OS], { config: PRIVADO }).status).toBe(2);
  });
});
