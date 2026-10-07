import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('historical saga completion migration', () => {
  it('preserves published rows and deterministically keeps a published duplicate', () => {
    const sql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20261007010000_unique_saga_completion_per_order/migration.sql'),
      'utf8'
    );

    expect(sql).toContain("WHEN \"publishedAt\" IS NOT NULL THEN 'COMPLETED'");
    expect(sql).toContain('ORDER BY (\"publishedAt\" IS NULL), \"createdAt\", \"eventId\"');
    expect(sql.indexOf('DELETE FROM "SagaCompletion"')).toBeLessThan(
      sql.indexOf('CREATE UNIQUE INDEX "SagaCompletion_ordemServicoId_key"')
    );
  });
});
