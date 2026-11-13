param([switch]$ExerciseDatabaseOutage)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $projectRoot 'infra\docker\compose.yaml'

function Invoke-FirstWorkCompose {
    $output = & docker compose -p firstwork -f $composeFile @args
    if ($LASTEXITCODE -ne 0) {
        throw "FirstWork Compose command failed with exit code $LASTEXITCODE."
    }
    return $output
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(20)

function Read-Endpoint {
    param([string]$Path)
    $response = $client.GetAsync("http://127.0.0.1:18208$Path").GetAwaiter().GetResult()
    try {
        return [PSCustomObject]@{
            Status = [int]$response.StatusCode
            Body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        }
    } finally {
        $response.Dispose()
    }
}

function Assert-Healthy {
    foreach ($name in @('liveness', 'readiness')) {
        $probe = Read-Endpoint "/actuator/health/$name"
        Assert-True ($probe.Status -eq 200 -and $probe.Body.status -eq 'UP') "$name is not UP."
    }
    $system = Read-Endpoint '/api/v1/system'
    Assert-True ($system.Status -eq 200 -and $system.Body.schemaVersion -eq 'phase-1') 'Migrated database metadata is not available.'
}

try {
    $ids = @(Invoke-FirstWorkCompose ps --status running --quiet db api web)
    Assert-True ($ids.Count -eq 3) 'Expected exactly three running FirstWork runtime services.'
    $inspection = & docker inspect @ids | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect FirstWork containers.' }
    foreach ($container in $inspection) {
        $service = $container.Config.Labels.'com.docker.compose.service'
        Assert-True ($container.Config.Labels.'com.docker.compose.project' -eq 'firstwork') 'Unexpected container ownership.'
        Assert-True ($container.State.Health.Status -eq 'healthy') "$service is not healthy."
        Assert-True ($container.HostConfig.Memory -gt 0 -and $container.HostConfig.NanoCpus -gt 0 -and $container.HostConfig.PidsLimit -gt 0) "$service has an unbounded runtime resource."
        Assert-True ($container.HostConfig.ReadonlyRootfs) "$service root filesystem is writable."
        Assert-True ($container.Config.User -and $container.Config.User -notmatch '^(0|root)(:|$)') "$service is configured as root."
        Assert-True ($container.HostConfig.CapDrop -contains 'ALL') "$service retains Linux capabilities."
        Assert-True (@($container.HostConfig.SecurityOpt | Where-Object { $_ -like 'no-new-privileges*' }).Count -eq 1) "$service lacks no-new-privileges."
        $bindings = @($container.HostConfig.PortBindings.PSObject.Properties)
        if ($service -eq 'db') {
            Assert-True ($bindings.Count -eq 0) 'Database port must not be published.'
            $networks = @($container.NetworkSettings.Networks.PSObject.Properties.Name)
            Assert-True ($networks.Count -eq 1 -and $networks[0] -eq 'firstwork_backend') 'Database is not isolated on the backend network.'
        } else {
            $expectedPort = if ($service -eq 'web') { '18108' } else { '18208' }
            Assert-True ($bindings.Count -eq 1) "$service has unexpected port bindings."
            $published = @($container.HostConfig.PortBindings.'8080/tcp')
            Assert-True ($published.Count -eq 1 -and $published[0].HostIp -eq '127.0.0.1' -and $published[0].HostPort -eq $expectedPort) "$service is not bound to its reserved loopback port."
        }
        Write-Output "$service verified: healthy, non-root, read-only, CPU=$($container.HostConfig.NanoCpus / 1000000000), memoryMiB=$($container.HostConfig.Memory / 1MB), pids=$($container.HostConfig.PidsLimit)."
    }
    $internal = & docker network inspect firstwork_backend --format '{{.Internal}}'
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect FirstWork backend network.' }
    Assert-True ($internal -eq 'true') 'Backend network is not internal.'

    $configuration = Invoke-FirstWorkCompose --profile tools config --format json | ConvertFrom-Json
    foreach ($service in $configuration.services.PSObject.Properties) {
        Assert-True ($service.Value.mem_limit -gt 0 -and $service.Value.cpus -gt 0 -and $service.Value.pids_limit -gt 0) "$($service.Name) lacks explicit resource limits."
    }
    Assert-Healthy

    $migration = Invoke-FirstWorkCompose exec -T db psql -U firstwork -d firstwork -At -c 'SELECT version || '':'' || success FROM flyway_schema_history ORDER BY installed_rank;'
    Assert-True ($migration -eq '1:true') 'Unexpected Flyway migration result.'
    $tables = Invoke-FirstWorkCompose exec -T db psql -U firstwork -d firstwork -At -c "SELECT string_agg(tablename, ',' ORDER BY tablename) FROM pg_tables WHERE schemaname = 'public';"
    Assert-True ($tables -eq 'flyway_schema_history,prototype_metadata') 'Unexpected domain tables exist in Phase 1.'
    Write-Output "PostgreSQL verified: Flyway=$migration; public tables=$tables."

    # Docker can start these containers in any order after it restarts, so the web
    # server has to come up even when its API upstream cannot be resolved yet.
    $webImage = ($inspection | Where-Object { $_.Config.Labels.'com.docker.compose.service' -eq 'web' }).Image
    $probe = & docker run --detach --network none --read-only --tmpfs '/tmp:rw,noexec,nosuid,size=16m' --cap-drop ALL --security-opt 'no-new-privileges:true' --cpus 0.25 --memory 64m --pids-limit 32 $webImage
    if ($LASTEXITCODE -ne 0) { throw 'Could not start the web start-order probe.' }
    try {
        $served = $false
        foreach ($attempt in 1..20) {
            if (-not (& docker ps --quiet --filter "id=$probe")) { break }
            & docker exec $probe sh -c 'wget --quiet --output-document=/dev/null http://127.0.0.1:8080/ 2>/dev/null'
            if ($LASTEXITCODE -eq 0) { $served = $true; break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $served) { & docker logs --tail 5 $probe }
        Assert-True $served 'The web server does not start without its API upstream.'
    } finally {
        & docker rm --force $probe | Out-Null
    }
    Write-Output 'web verified: starts and serves the page without its API upstream.'

    if ($ExerciseDatabaseOutage) {
        Invoke-FirstWorkCompose pause db
        try {
            Start-Sleep -Seconds 2
            $liveness = Read-Endpoint '/actuator/health/liveness'
            Assert-True ($liveness.Status -eq 200 -and $liveness.Body.status -eq 'UP') 'Database outage incorrectly affected process liveness.'
            $readiness = Read-Endpoint '/actuator/health/readiness'
            Assert-True ($readiness.Status -eq 503 -and $readiness.Body.status -eq 'DOWN') 'Readiness did not detect the database outage.'
            $system = Read-Endpoint '/api/v1/system'
            Assert-True ($system.Status -eq 503 -and $system.Body.title -eq 'Database unavailable') 'DB-backed endpoint did not report its dependency failure safely.'
            Write-Output 'Database paused: liveness=200/UP, readiness=503/DOWN, system=503/Database unavailable.'
        } finally {
            Invoke-FirstWorkCompose unpause db
        }
        $deadline = [DateTime]::UtcNow.AddSeconds(90)
        do {
            Start-Sleep -Seconds 2
            $readiness = Read-Endpoint '/actuator/health/readiness'
            if ($readiness.Status -eq 200 -and $readiness.Body.status -eq 'UP') { break }
        } while ([DateTime]::UtcNow -lt $deadline)
        Assert-Healthy
        Write-Output 'Database resumed: liveness, readiness, and DB-backed system status recovered.'
    }
    Write-Output 'FirstWork runtime verification passed.'
} finally {
    $client.Dispose()
}
