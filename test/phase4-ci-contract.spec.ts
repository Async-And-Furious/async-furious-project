import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflowPath = (name: string): string => join(process.cwd(), '.github', 'workflows', name);

const readWorkflow = (name: string): string => readFileSync(workflowPath(name), 'utf8');

const jobBlock = (workflow: string, name: string): string => {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${name}:`);
  if (start === -1) return '';

  const nextJob = lines.findIndex(
    (line, index) => index > start && /^ {2}[a-zA-Z0-9_-]+:\s*$/.test(line)
  );
  return lines.slice(start, nextJob === -1 ? undefined : nextJob).join('\n');
};

describe('Phase 4 CI contract', () => {
  it('keeps the PROD deployment job inert', () => {
    const deployWorkflow = readWorkflow('deploy-eks.yml');

    expect(jobBlock(deployWorkflow, 'deploy-prod')).toMatch(/^\s{4}if:\s*false\s*$/m);
  });

  it('limits manual Phase 4 deployment and seed targets to HML', () => {
    expect(readWorkflow('deploy-eks.yml')).toMatch(/^\s+options:\s*\[hml\]\s*$/m);
    expect(readWorkflow('seed-eks.yml')).toMatch(/^\s+options:\s*\[hml\]\s*$/m);
  });

  it('does not let the Documentation label skip required CI gates', () => {
    const documentationLabelSkip =
      /contains\(github\.event\.pull_request\.labels\.\*\.name,\s*'Documentação'\)/;

    for (const workflowName of ['tests.yml', 'trivy.yml', 'zap.yml', 'terraform.yml']) {
      expect(readWorkflow(workflowName)).not.toMatch(documentationLabelSkip);
    }
  });

  it('keeps Terraform plan limited to pull requests', () => {
    const planJob = jobBlock(readWorkflow('terraform.yml'), 'plan');

    expect(planJob).toMatch(
      /^\s{4}if:\s*\$\{\{\s*github\.event_name == 'pull_request'\s*\}\}\s*$/m
    );
  });

  it('fails the aggregate check when tests fail or required Sonar is skipped', () => {
    const requiredChecks = jobBlock(readWorkflow('tests.yml'), 'validate');

    expect(requiredChecks).toMatch(/^\s{4}if:\s*\$\{\{\s*always\(\)\s*\}\}\s*$/m);
    expect(requiredChecks).toMatch(/^\s{4}needs:\s*\[test, sonar\]\s*$/m);
    expect(requiredChecks).toMatch(/\[\[ "\$TEST_RESULT" == 'success' \]\]/);
    expect(requiredChecks).toMatch(
      /\[\[ "\$SONAR_REQUIRED" == 'true' && "\$SONAR_RESULT" != 'success' \]\]/
    );
  });

  it('pins the SonarCloud action to an immutable release commit', () => {
    const sonarJob = jobBlock(readWorkflow('tests.yml'), 'sonar');

    expect(sonarJob).toMatch(
      /uses:\s*SonarSource\/sonarqube-scan-action@[0-9a-f]{40}\s+# v8\.4\.0/
    );
  });
});
