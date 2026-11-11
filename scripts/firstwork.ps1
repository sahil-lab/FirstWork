param(
    [ValidateSet('Initialize', 'Format', 'Check', 'Start', 'Smoke', 'Status', 'Stop')]
    [string]$Action = 'Status'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $projectRoot 'infra\docker\compose.yaml'

function Invoke-FirstWorkCompose {
    & docker compose -p firstwork -f $composeFile @args
    if ($LASTEXITCODE -ne 0) {
        throw "FirstWork Compose command failed with exit code $LASTEXITCODE."
    }
}

function Initialize-FirstWork {
    Invoke-FirstWorkCompose --profile tools run --rm --no-deps web-check node scripts/initialize-local.mjs
}

function Test-FirstWork {
    Invoke-FirstWorkCompose --profile tools run --rm --no-deps api-check
    Invoke-FirstWorkCompose --profile tools run --rm --no-deps web-check
}

Push-Location $projectRoot
try {
    & docker info --format '{{.OSType}}'
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker is unavailable. Start Docker Desktop with Linux containers.'
    }
    switch ($Action) {
        'Initialize' {
            Initialize-FirstWork
        }
        'Format' {
            Invoke-FirstWorkCompose --profile tools run --rm --no-deps api-check mvn --batch-mode --no-transfer-progress '-Dmaven.repo.local=/workspace/.local/m2' spotless:apply
            Invoke-FirstWorkCompose --profile tools run --rm --no-deps web-check npm run format
        }
        'Check' {
            Test-FirstWork
        }
        'Start' {
            Initialize-FirstWork
            Test-FirstWork
            Invoke-FirstWorkCompose up --detach --build --wait --wait-timeout 180 db api web
            Invoke-FirstWorkCompose --profile tools run --rm --no-deps smoke
        }
        'Smoke' {
            Invoke-FirstWorkCompose --profile tools run --rm --no-deps smoke
        }
        'Status' {
            Invoke-FirstWorkCompose ps
        }
        'Stop' {
            Invoke-FirstWorkCompose stop db api web
        }
    }
} finally {
    Pop-Location
}
