param(
    [ValidateSet('run', 'start', 'stop')]
    [string]$Mode = 'run',
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$MongoData = 'C:\MongoDB'
$MongoUrl = 'mongodb://127.0.0.1:27017/?directConnection=true'
$EventFile = Join-Path $Root 'waves-app\public\event.json'
$StartlistCsv = Join-Path $Root 'waves-app\public\startlist.csv'
$InputDir = Join-Path $Root 'data\input'
$LogDir = Join-Path $Root 'data\logs'

function Invoke-Quiet([scriptblock]$Action) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $global:LASTEXITCODE = 1
    try {
        & $Action *> $null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Add-PathIfPresent([string]$Dir) {
    if ($Dir -and (Test-Path -LiteralPath $Dir)) {
        $parts = $env:Path -split ';'
        if ($parts -notcontains $Dir) {
            $env:Path = "$Dir;$env:Path"
        }
    }
}

Add-PathIfPresent "$env:LOCALAPPDATA\Microsoft\WinGet\Links"
Add-PathIfPresent "$env:LOCALAPPDATA\pnpm"
Add-PathIfPresent "$env:APPDATA\npm"
Add-PathIfPresent 'C:\Program Files\nodejs'

function Find-Python {
    $candidates = @()
    foreach ($pattern in @(
        "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe",
        "$env:LOCALAPPDATA\Python\pythoncore-*\python.exe",
        "$env:LOCALAPPDATA\Python\bin\python.exe",
        'C:\Program Files\Python*\python.exe',
        'C:\Python*\python.exe'
    )) {
        $hits = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
        foreach ($h in $hits) { $candidates += $h.FullName }
    }
    $wgPkgDir = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages"
    if (Test-Path -LiteralPath $wgPkgDir) {
        $wgHits = Get-ChildItem -Path "$wgPkgDir\*Python*" -Filter 'python.exe' -Recurse -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending
        foreach ($h in $wgHits) { $candidates += $h.FullName }
    }
    foreach ($cmd in (Get-Command 'python.exe', 'py.exe' -All -ErrorAction SilentlyContinue)) {
        $candidates += $cmd.Source
    }

    foreach ($cand in ($candidates | Select-Object -Unique)) {
        if (-not $cand -or ($cand -like '*\Microsoft\WindowsApps\*')) { continue }
        $ok = Invoke-Quiet { & $cand -c 'import sys' }
        if ($ok) {
            $pyDir = Split-Path -Parent $cand
            if ($pyDir -and ($pyDir -ne $env:SystemRoot)) {
                Add-PathIfPresent (Join-Path $pyDir 'Scripts')
                $other = ($env:Path -split ';') | Where-Object { $_ -and ($_ -ne $pyDir) }
                $env:Path = (@($pyDir) + $other) -join ';'
            }
            return $cand
        }
    }
    return $null
}

function Find-Mongod {
    $cmd = Get-Command 'mongod' -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @()
    $patterns = @(
        'C:\Program Files\MongoDB\Server\*\bin\mongod.exe',
        'C:\Program Files\MongoDB\*\bin\mongod.exe'
    )
    foreach ($pat in $patterns) {
        $candidates += Get-ChildItem -Path $pat -ErrorAction SilentlyContinue
    }
    $best = $candidates | Sort-Object FullName -Descending | Select-Object -First 1
    if ($best) {
        Add-PathIfPresent (Split-Path -Parent $best.FullName)
        return $best.FullName
    }
    return $null
}

function Find-Mongosh {
    $cmd = Get-Command 'mongosh' -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @()
    $roots = @(
        'C:\Program Files\mongosh',
        'C:\Program Files\MongoDB',
        "$env:LOCALAPPDATA\Programs\mongosh",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links"
    )
    foreach ($r in $roots) {
        if (Test-Path -LiteralPath $r) {
            $candidates += Get-ChildItem -Path $r -Filter 'mongosh.exe' -Recurse -ErrorAction SilentlyContinue
        }
    }
    $best = $candidates | Sort-Object FullName -Descending | Select-Object -First 1
    if ($best) {
        Add-PathIfPresent (Split-Path -Parent $best.FullName)
        return $best.FullName
    }
    return $null
}

function Find-Nginx {
    $candidates = @()
    $patterns = @(
        'C:\nginx\nginx.exe',
        'C:\nginx*\nginx.exe',
        'C:\Program Files\nginx*\nginx.exe'
    )
    foreach ($pat in $patterns) {
        $candidates += Get-ChildItem -Path $pat -ErrorAction SilentlyContinue
    }
    $wgPkgDir = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages"
    if (Test-Path -LiteralPath $wgPkgDir) {
        $candidates += Get-ChildItem -Path "$wgPkgDir\*nginx*" -Filter 'nginx.exe' -Recurse -ErrorAction SilentlyContinue
    }
    $best = $candidates | Sort-Object FullName -Descending | Select-Object -First 1
    if ($best) { return $best.FullName }
    $cmd = Get-Command 'nginx' -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Find-Pnpm {
    $candidates = @()
    foreach ($fixed in @("$env:LOCALAPPDATA\pnpm\pnpm.exe", "$env:LOCALAPPDATA\Microsoft\WinGet\Links\pnpm.exe")) {
        if (Test-Path -LiteralPath $fixed) { $candidates += $fixed }
    }
    $wgPkgDir = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages"
    if (Test-Path -LiteralPath $wgPkgDir) {
        $pkgHits = Get-ChildItem -Path $wgPkgDir -Filter 'pnpm.exe' -Recurse -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending
        foreach ($h in $pkgHits) { $candidates += $h.FullName }
    }
    foreach ($cmd in (Get-Command 'pnpm.exe', 'pnpm.cmd' -ErrorAction SilentlyContinue)) {
        $candidates += $cmd.Source
    }

    foreach ($cand in ($candidates | Select-Object -Unique)) {
        if (Invoke-Quiet { & $cand --version }) {
            Add-PathIfPresent (Split-Path -Parent $cand)
            return $cand
        }
    }
    return $null
}

function Test-PortListening([int]$Port) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return ($null -ne $conns -and @($conns).Count -gt 0)
    } catch {
        $line = netstat -ano | Select-String -Pattern ":$Port\s+.*LISTENING"
        return ($null -ne $line)
    }
}

function Stop-PortListener([int]$Port) {
    $pids = @()
    try {
        $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    } catch { }
    if (-not $pids -or @($pids).Count -eq 0) {
        $lines = netstat -ano | Select-String -Pattern ":$Port\s+.*LISTENING"
        foreach ($ln in $lines) {
            $tok = ($ln.ToString().Trim() -split '\s+')[-1]
            if ($tok -match '^\d+$') { $pids += [int]$tok }
        }
    }
    foreach ($procId in ($pids | Sort-Object -Unique)) {
        if ($procId -le 4) { continue }
        [void](Invoke-Quiet { taskkill /PID $procId /T /F })
    }
}

function Stop-WavesServices {
    param([switch]$Quiet)
    $mongoshExe = Find-Mongosh
    $pyExe = Find-Python

    if (-not $Quiet) { Write-Host 'Closing the app and the sync server...' }
    Stop-PortListener 5173
    Stop-PortListener 3000
    Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'server\.ts|pnpm\.cmd dev|pnpm dev|waves-server|waves-app' } |
        ForEach-Object {
            $targetPid = $_.ProcessId
            [void](Invoke-Quiet { taskkill /PID $targetPid /T /F })
        }

    if (-not $Quiet) { Write-Host 'Closing the web server...' }
    [void](Invoke-Quiet { taskkill /im nginx.exe /f })

    if ($pyExe -and (Test-Path -LiteralPath $EventFile) -and (Get-Process -Name 'mongod' -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $Root 'scripts\count_people_on_course.py'))) {
        if (-not $Quiet) { Write-Host 'Saving final meet archive files...' }
        $argsList = @((Join-Path $Root 'scripts\count_people_on_course.py'), '--live')
        if ($Quiet) {
            $argsList += '--quiet'
            [void](Invoke-Quiet { & $pyExe @argsList })
        } else {
            try {
                & $pyExe @argsList
            } catch { }
        }
    }

    if (Get-Process -Name 'mongod' -ErrorAction SilentlyContinue) {
        if (-not $Quiet) { Write-Host 'Closing the database (this takes a few seconds)...' }
        if ($mongoshExe) {
            [void](Invoke-Quiet { & $mongoshExe --quiet $MongoUrl --eval "db.adminCommand({ shutdown: 1, force: true })" })
        }
        $tries = 0
        while ((Get-Process -Name 'mongod' -ErrorAction SilentlyContinue) -and $tries -lt 15) {
            Start-Sleep -Seconds 1
            $tries++
        }
        if (Get-Process -Name 'mongod' -ErrorAction SilentlyContinue) {
            if (-not $Quiet) { Write-Host 'Forcing database shutdown...' }
            [void](Invoke-Quiet { taskkill /im mongod.exe /f })
        }
    }

    if (-not $Quiet) {
        Write-Host ''
        Write-Host '==========================================================='
        Write-Host ' Waves is stopped. Your meet data and CSV archives are saved.'
        Write-Host '==========================================================='
    }
}

function Ensure-StartList {
    param([string]$PyExe)
    if (-not (Test-Path -LiteralPath $InputDir)) {
        New-Item -ItemType Directory -Path $InputDir -Force | Out-Null
    }
    $workbooks = Get-ChildItem -Path $InputDir -File -ErrorAction SilentlyContinue |
        Where-Object { ($_.Extension -in '.xlsx', '.xlsm') -and (-not $_.Name.StartsWith('~$')) }

    if ($workbooks.Count -gt 1) {
        throw "Multiple Excel files found in data\input\. Keep only this meet's workbook there."
    }

    if ($workbooks.Count -eq 1) {
        $wb = $workbooks[0]
        $needsImport = (-not (Test-Path -LiteralPath $EventFile)) -or (-not (Test-Path -LiteralPath $StartlistCsv))
        if (-not $needsImport) {
            try {
                $ev = Get-Content -LiteralPath $EventFile -Raw | ConvertFrom-Json
                if ($ev.source -ne $wb.Name) { $needsImport = $true }
            } catch {
                $needsImport = $true
            }
        }
        if (-not $needsImport) {
            $csvTime = (Get-Item -LiteralPath $StartlistCsv).LastWriteTimeUtc
            if ($wb.LastWriteTimeUtc -gt $csvTime) { $needsImport = $true }
        }
        if ($needsImport) {
            if (-not $PyExe) {
                throw 'Python was not found, so the Excel start list could not be imported. Run setup.cmd first.'
            }
            Write-Host "Importing start list from $($wb.Name)..."
            & $PyExe (Join-Path $Root 'scripts\startsheet_to_csv.py')
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to import $($wb.Name). Make sure Excel is closed and check the errors above."
            }
        }
    } elseif (-not (Test-Path -LiteralPath $EventFile)) {
        throw "No start list found. Put your Excel start list (.xlsx or .xlsm) in $InputDir and run Waves again."
    }
}

function Start-WavesServices {
    $mongodExe = Find-Mongod
    $mongoshExe = Find-Mongosh
    $nginxExe = Find-Nginx
    $pyExe = Find-Python
    $pnpmExe = Find-Pnpm
    $npmCmd = Get-Command 'npm' -ErrorAction SilentlyContinue

    if (-not $mongodExe) { throw 'MongoDB (mongod.exe) was not found. Double-click setup.cmd to install dependencies automatically.' }
    if (-not $mongoshExe) { throw 'MongoDB Shell (mongosh.exe) was not found. Double-click setup.cmd to install dependencies automatically.' }
    if (-not $nginxExe) { throw 'nginx (nginx.exe) was not found. Double-click setup.cmd to install dependencies automatically.' }
    if (-not $pnpmExe) { throw '"pnpm" was not found or is broken. Double-click setup.cmd to install dependencies automatically.' }

    $mongoRunning = $null -ne (Get-Process -Name 'mongod' -ErrorAction SilentlyContinue)
    if ($mongoRunning -and (Test-PortListening 3000) -and (Test-PortListening 5173)) {
        Write-Host 'Waves is already running. Opening http://localhost ...'
        Start-Process 'http://localhost'
        return $false
    }
    if ($mongoRunning) {
        if ((Test-PortListening 3000) -or (Test-PortListening 5173)) {
            Write-Host 'Previous Waves session did not close cleanly. Resetting before launch...'
        } else {
            Write-Host 'Resetting background database service before launch...'
        }
        Stop-WavesServices -Quiet
        Start-Sleep -Seconds 1
    }

    if (-not (Test-Path -LiteralPath $MongoData)) { New-Item -ItemType Directory -Path $MongoData -Force | Out-Null }
    if (-not (Test-Path -LiteralPath $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

    $serverModules = Join-Path $Root 'waves-server\node_modules'
    if (-not (Test-Path -LiteralPath $serverModules)) {
        Write-Host 'Installing sync server packages (first-time setup)...'
        Push-Location (Join-Path $Root 'waves-server')
        if ($npmCmd) { & npm.cmd install } else { & $pnpmExe install }
        Pop-Location
    }
    $appModules = Join-Path $Root 'waves-app\node_modules'
    if (-not (Test-Path -LiteralPath $appModules)) {
        Write-Host 'Installing web app packages (first-time setup)...'
        Push-Location (Join-Path $Root 'waves-app')
        & $pnpmExe install
        Pop-Location
    }

    Ensure-StartList -PyExe $pyExe

    Write-Host '[1/5] Starting the database...'
    Start-Process -FilePath $mongodExe `
        -ArgumentList "--dbpath=`"$MongoData`" --bind_ip=127.0.0.1 --port=27017 --replSet=rs0" `
        -WindowStyle Hidden

    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        if (Invoke-Quiet { & $mongoshExe --quiet $MongoUrl --eval "db.runCommand({ping:1}).ok" }) {
            $ready = $true; break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'Database (mongod) did not respond in time.' }

    Write-Host '[2/5] Checking the database set-up...'
    [void](Invoke-Quiet { & $mongoshExe --quiet $MongoUrl --eval "try { rs.status().ok } catch (e) { rs.initiate({ _id: 'rs0', members: [ { _id: 0, host: '127.0.0.1:27017' } ] }) }" })
    $primary = $false
    for ($i = 0; $i -lt 30; $i++) {
        if (Invoke-Quiet { & $mongoshExe --quiet $MongoUrl --eval "if (!db.hello().isWritablePrimary) { quit(1) }" }) {
            $primary = $true; break
        }
        Start-Sleep -Seconds 2
    }
    if (-not $primary) { throw 'Database replica set did not become ready.' }

    Write-Host '[3/5] Starting the sync server (this can take up to a minute)...'
    $emptyIn = Join-Path $LogDir 'empty.in'
    Set-Content -LiteralPath $emptyIn -Value '' -NoNewline
    $syncOut = Join-Path $LogDir 'sync-server.log'
    $syncErr = Join-Path $LogDir 'sync-server.err.log'
    $tsHookJs = 'import { readFileSync } from "node:fs"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url"; export async function load(url, ctx, next) { if (!url.endsWith(".ts")) return next(url, ctx); const ts = createRequire(url)("typescript"); const src = readFileSync(fileURLToPath(url), "utf8"); const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }); return { format: "module", shortCircuit: true, source: outputText }; }'
    $tsHookB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($tsHookJs))
    $syncEval = "import{register}from'node:module';register('data:text/javascript;base64,$tsHookB64');await import('./server.ts')"
    $syncProc = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList "/c node --input-type=module -e `"$syncEval`"" `
        -WorkingDirectory (Join-Path $Root 'waves-server') `
        -RedirectStandardInput $emptyIn `
        -RedirectStandardOutput $syncOut `
        -RedirectStandardError $syncErr `
        -PassThru `
        -WindowStyle Hidden

    $serverUp = $false
    for ($i = 0; $i -lt 45; $i++) {
        if (Test-PortListening 3000) { $serverUp = $true; break }
        if ($syncProc.HasExited) { break }
        Start-Sleep -Seconds 1
    }
    if (-not $serverUp) {
        $errTail = if (Test-Path $syncErr) { (Get-Content $syncErr -Tail 15) -join "`n" } else { '' }
        throw "Sync server did not start.`n$errTail"
    }

    Write-Host '[4/5] Starting the web server...'
    $nginxDir = Split-Path -Parent $nginxExe
    foreach ($sub in @('logs', 'temp')) {
        $subPath = Join-Path $nginxDir $sub
        if (-not (Test-Path -LiteralPath $subPath)) {
            New-Item -ItemType Directory -Path $subPath -Force | Out-Null
        }
    }
    $nginxConf = Join-Path $Root 'waves-server\nginx.conf'
    Start-Process -FilePath $nginxExe `
        -ArgumentList "-p `"$nginxDir`" -c `"$nginxConf`"" `
        -WindowStyle Hidden

    Write-Host '[5/5] Starting the app...'
    $appOut = Join-Path $LogDir 'web-app.log'
    $appErr = Join-Path $LogDir 'web-app.err.log'
    $appProc = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList "/c `"`"$pnpmExe`" dev`"" `
        -WorkingDirectory (Join-Path $Root 'waves-app') `
        -RedirectStandardInput $emptyIn `
        -RedirectStandardOutput $appOut `
        -RedirectStandardError $appErr `
        -PassThru `
        -WindowStyle Hidden

    $appUp = $false
    for ($i = 0; $i -lt 30; $i++) {
        if (Test-PortListening 5173) { $appUp = $true; break }
        if ($appProc.HasExited) { break }
        Start-Sleep -Seconds 1
    }
    if (-not $appUp) {
        $errTail = if (Test-Path $appErr) { (Get-Content $appErr -Tail 15) -join "`n" } else { '' }
        throw "Web app did not start.`n$errTail"
    }

    return $true
}

function Get-LanUrls {
    try {
        $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object {
                $_.IPAddress -notmatch '^127\.' -and
                $_.IPAddress -notmatch '^169\.254\.' -and
                $_.PrefixOrigin -ne 'WellKnown'
            } |
            Select-Object -ExpandProperty IPAddress -Unique
        return $ips | ForEach-Object { "http://$_" }
    } catch {
        return @()
    }
}

try {
    if ($Mode -eq 'stop') {
        Write-Host ''
        Write-Host '===== Waves: stop ====='
        Write-Host ''
        Stop-WavesServices
        if (-not $NoPause) {
            Write-Host ''
            Read-Host 'Press Enter to close' | Out-Null
        }
        exit 0
    }

    Write-Host ''
    Write-Host '===== Waves ====='
    Write-Host ''
    $startedFresh = Start-WavesServices
    if (-not $startedFresh) {
        if (-not $NoPause -and $Mode -eq 'run') { Start-Sleep -Seconds 2 }
        exit 0
    }

    $meetName = ''
    if (Test-Path -LiteralPath $EventFile) {
        try {
            $ev = Get-Content -LiteralPath $EventFile -Raw | ConvertFrom-Json
            $meetName = $ev.meetName
        } catch { }
    }
    $lanUrls = Get-LanUrls

    Write-Host ''
    Write-Host '==========================================================='
    Write-Host ' Waves is running!'
    if ($meetName) { Write-Host " Meet        : $meetName" }
    Write-Host ' Host URL    : http://localhost'
    foreach ($u in $lanUrls) { Write-Host " Device URL  : $u" }
    if ($meetName) { Write-Host " Auto Archive: data\archive\$meetName" }
    Write-Host '==========================================================='

    Start-Process 'http://localhost'

    if ($Mode -eq 'start') {
        if (-not $NoPause) {
            Write-Host ''
            Write-Host 'Run scripts\waves-manager.ps1 -Mode stop when finished.'
            Read-Host 'Press Enter to close this launcher window' | Out-Null
        }
        exit 0
    }

    # Interactive single-window 'run' mode: launch a lightweight hidden watchdog tied to $PID so even
    # clicking the window X or OS shutdown cleanly exports archives and stops all Waves services.
    Get-ChildItem -Path $LogDir -Filter 'stopped-*.flag' -ErrorAction SilentlyContinue |
        Remove-Item -Force -ErrorAction SilentlyContinue
    $scriptPath = $MyInvocation.MyCommand.Path
    $cleanStopMarker = Join-Path $LogDir "stopped-$PID.flag"
    $watchdogCmd = "while (Get-Process -Id $PID -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 700 }; if (Test-Path -LiteralPath '$cleanStopMarker') { Remove-Item -LiteralPath '$cleanStopMarker' -Force -ErrorAction SilentlyContinue } else { & '$scriptPath' -Mode stop -NoPause }"
    $encodedWatchdog = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($watchdogCmd))
    Start-Process -FilePath 'powershell.exe' `
        -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -EncodedCommand $encodedWatchdog" `
        -WindowStyle Hidden

    Write-Host ''
    Write-Host 'Leave this window open while the meet is running (minimizing is fine).'
    Write-Host 'Your CSVs save continuously in the background.'
    Write-Host 'Press [Q] or close this window to stop Waves cleanly...'

    try {
        while ($true) {
            if (-not [Console]::IsInputRedirected -and [Console]::KeyAvailable) {
                $key = [Console]::ReadKey($true)
                if ($key.Key -eq 'Q' -or $key.Key -eq 'Enter' -or $key.Key -eq 'Escape') {
                    Write-Host ''
                    Write-Host 'Stopping Waves...'
                    break
                }
            }
            if (-not (Get-Process -Name 'mongod' -ErrorAction SilentlyContinue)) {
                break
            }
            Start-Sleep -Milliseconds 250
        }
    } finally {
        Set-Content -LiteralPath $cleanStopMarker -Value 'done' -ErrorAction SilentlyContinue
        Write-Host ''
        Stop-WavesServices
    }
} catch {
    Write-Host ''
    Write-Host "PROBLEM: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $NoPause) {
        Write-Host ''
        Read-Host 'Press Enter to close' | Out-Null
    }
    exit 1
}
