[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [ValidateSet('hml', 'prod')]
    [string] $Environment,
    [Parameter(Mandatory)]
    [ValidateSet('apply', 'destroy')]
    [string] $Action,
    [string] $Confirmation,
    [ValidateSet('develop', 'main')]
    [string] $AppRef,
    [ValidateRange(5, 300)]
    [int] $PollSeconds = 10
)

$ErrorActionPreference = 'Stop'
$owner = 'Async-And-Furious'
$ref = 'main'
$expectedDestroyConfirmation = "DESTROY $($Environment.ToUpperInvariant())"

if ($Action -eq 'destroy' -and $Confirmation -cne $expectedDestroyConfirmation) {
    throw "Destroy requires exact -Confirmation '$expectedDestroyConfirmation'."
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI (gh) is not installed or is not on PATH.'
}
& gh auth status 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not authenticated. Run: gh auth login' }

function Invoke-GhJson {
    param([Parameter(Mandatory)][string[]] $Arguments)
    $output = & gh @Arguments
    if ($LASTEXITCODE -ne 0) { throw "gh failed: gh $($Arguments -join ' ')" }
    $output | ConvertFrom-Json
}

function Invoke-Workflow {
    param(
        [Parameter(Mandatory)][string] $Repository,
        [Parameter(Mandatory)][string] $Workflow,
        [Parameter(Mandatory)][hashtable] $Inputs
    )
    $repo = "$owner/$Repository"
    $dispatchAt = [DateTime]::UtcNow
    $workflowRef = if ($Repository -eq 'async-furious-project') { $appWorkflowRef } else { $ref }
    $arguments = @('workflow', 'run', $Workflow, '--repo', $repo, '--ref', $workflowRef)
    foreach ($entry in $Inputs.GetEnumerator()) { $arguments += @('--field', "$($entry.Key)=$($entry.Value)") }

    Write-Host "Dispatching ${repo}:$Workflow ($Environment, $Action) on $workflowRef"
    & gh @arguments
    if ($LASTEXITCODE -ne 0) { throw "Unable to dispatch ${repo}:$Workflow." }

    $run = $null
    while ($null -eq $run) {
        Start-Sleep -Seconds $PollSeconds
        $runs = Invoke-GhJson @('run', 'list', '--repo', $repo, '--workflow', $Workflow, '--event', 'workflow_dispatch', '--limit', '20', '--json', 'databaseId,url,status,conclusion,createdAt,headBranch')
        $run = @($runs | Where-Object {
            $_.headBranch -eq $workflowRef -and ([DateTime]$_.createdAt).ToUniversalTime() -ge $dispatchAt.AddSeconds(-5)
        } | Sort-Object createdAt -Descending)[0]
    }

    Write-Host "Run: $($run.url)"
    do {
        $current = Invoke-GhJson @('run', 'view', [string]$run.databaseId, '--repo', $repo, '--json', 'status,conclusion,url')
        Write-Host "  status=$($current.status)"
        if ($current.status -ne 'completed') { Start-Sleep -Seconds $PollSeconds }
    } while ($current.status -ne 'completed')
    Write-Host "  conclusion=$($current.conclusion)"
    if ($current.conclusion -ne 'success') {
        throw "${repo}:$Workflow failed with conclusion '$($current.conclusion)'. See $($current.url)"
    }
}

$applyConfirmation = if ($Environment -eq 'prod') { 'APPLY PROD' } else { '' }
$steps = if ($Action -eq 'apply') {
    @(
        @{ Repository = 'repo-k8s-infra'; Workflow = 'ci.yml'; Inputs = @{ environment = $Environment; action = 'apply'; academy_mode = 'false'; confirm = $applyConfirmation } },
        @{ Repository = 'repo-db-infra'; Workflow = 'ci.yml'; Inputs = @{ environment = $Environment; action = 'apply'; academy_mode = 'false'; confirm = $applyConfirmation } },
        @{ Repository = 'repo-auth-serverless'; Workflow = 'ci.yml'; Inputs = @{ environment = $Environment; operation = 'apply'; deploy_auth_only = 'false'; confirm = $applyConfirmation } },
        @{ Repository = 'async-furious-project'; Workflow = 'deploy-eks.yml'; Inputs = @{ environment = $Environment; seed_prod = 'false' } }
    )
} else {
    @(
        @{ Repository = 'async-furious-project'; Workflow = 'cleanup-eks.yml'; Inputs = @{ environment = $Environment; aws_academy = 'false'; operation = 'destroy'; confirm = $Confirmation } },
        @{ Repository = 'repo-auth-serverless'; Workflow = 'down.yml'; Inputs = @{ environment = $Environment; confirm = $Confirmation } },
        @{ Repository = 'repo-db-infra'; Workflow = 'down.yml'; Inputs = @{ environment = $Environment; confirm = $Confirmation } },
        @{ Repository = 'repo-k8s-infra'; Workflow = 'down.yml'; Inputs = @{ environment = $Environment; confirm = $Confirmation } }
    )
}

foreach ($step in $steps) {
    $description = "$($step.Repository)/$($step.Workflow)"
    if ($PSCmdlet.ShouldProcess($description, 'dispatch and wait for completion')) {
        Invoke-Workflow -Repository $step.Repository -Workflow $step.Workflow -Inputs $step.Inputs
    } else {
        $inputText = ($step.Inputs.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', '
        $whatIfRef = if ($step.Repository -eq 'async-furious-project') { $appWorkflowRef } else { $ref }
        Write-Host "WhatIf: would dispatch $description on $whatIfRef with inputs: $inputText"
    }
}
