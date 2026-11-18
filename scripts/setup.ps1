$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host ''
Write-Host '===== Waves: First-Time Laptop Setup ====='
Write-Host ''

function Refresh-EnvPath {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath"
    foreach ($extra in @("$env:LOCALAPPDATA\Microsoft\WinGet\Links", "$env:LOCALAPPDATA\pnpm", "$env:APPDATA\npm", 'C:\Program Files\nodejs')) {
        if ((Test-Path -LiteralPath $extra) -and (($env:Path -split ';') -notcontains $extra)) {
            $env:Path = "$extra;$env:Path"
        }
    }
}

function Ensure-PowerShellPolicy {
    try {
        Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force -ErrorAction SilentlyContinue
    } catch { }
}

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

function Find-PythonExe {
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
                $scriptsDir = Join-Path $pyDir 'Scripts'
                if ((Test-Path -LiteralPath $scriptsDir) -and (($env:Path -split ';') -notcontains $scriptsDir)) {
                    $env:Path = "$scriptsDir;$env:Path"
                }
                $other = ($env:Path -split ';') | Where-Object { $_ -and ($_ -ne $pyDir) }
                $env:Path = (@($pyDir) + $other) -join ';'
            }
            return $cand
        }
    }
    return $null
}

function Find-MongodExe {
    $c = Get-Command 'mongod' -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    $found = Get-ChildItem -Path 'C:\Program Files\MongoDB\Server\*\bin\mongod.exe', 'C:\Program Files\MongoDB\*\bin\mongod.exe' -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($found) { return $found.FullName }
    return $null
}

function Find-MongoshExe {
    $c = Get-Command 'mongosh' -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    foreach ($r in @('C:\Program Files\mongosh', 'C:\Program Files\MongoDB', "$env:LOCALAPPDATA\Programs\mongosh", "$env:LOCALAPPDATA\Microsoft\WinGet\Packages", "$env:LOCALAPPDATA\Microsoft\WinGet\Links")) {
        if (Test-Path -LiteralPath $r) {
            $hit = Get-ChildItem -Path $r -Filter 'mongosh.exe' -Recurse -ErrorAction SilentlyContinue |
                Sort-Object FullName -Descending | Select-Object -First 1
            if ($hit) { return $hit.FullName }
        }
    }
    return $null
}

function Find-NginxExe {
    $patterns = @('C:\nginx\nginx.exe', 'C:\nginx*\nginx.exe', 'C:\Program Files\nginx*\nginx.exe')
    $hits = @()
    foreach ($pat in $patterns) {
        $hits += Get-ChildItem -Path $pat -ErrorAction SilentlyContinue
    }
    $wgPkgDir = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages"
    if (Test-Path -LiteralPath $wgPkgDir) {
        $hits += Get-ChildItem -Path "$wgPkgDir\*nginx*" -Filter 'nginx.exe' -Recurse -ErrorAction SilentlyContinue
    }
    $best = $hits | Sort-Object FullName -Descending | Select-Object -First 1
    if ($best) { return $best.FullName }
    $c = Get-Command 'nginx' -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    return $null
}

function Find-PnpmExe {
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
        if (Invoke-Quiet { & $cand --version }) { return $cand }
    }
    return $null
}

function Install-WithWinget([string]$PackageId, [string]$FriendlyName) {
    $wg = Get-Command 'winget' -ErrorAction SilentlyContinue
    if (-not $wg) {
        throw "Cannot auto-install $FriendlyName because 'winget' is not available on this Windows install. Install App Installer from the Microsoft Store or install $FriendlyName manually."
    }
    Write-Host "Installing $FriendlyName via winget..."
    & winget install --id $PackageId -e --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "winget failed while installing $FriendlyName (exit code $LASTEXITCODE)."
    }
    Refresh-EnvPath
}

try {
    Ensure-PowerShellPolicy
    Refresh-EnvPath

    Write-Host '[1/6] Checking Node.js...'
    if (-not (Get-Command 'node' -ErrorAction SilentlyContinue)) {
        Install-WithWinget -PackageId 'OpenJS.NodeJS.LTS' -FriendlyName 'Node.js LTS'
    } else {
        Write-Host "  Found Node.js: $(& node --version)"
    }

    Write-Host '[2/6] Checking Python...'
    $pyExe = Find-PythonExe
    if (-not $pyExe) {
        Install-WithWinget -PackageId 'Python.Python.3.12' -FriendlyName 'Python 3.12'
        $pyExe = Find-PythonExe
    }
    if (-not $pyExe) {
        throw 'Python was installed but python.exe could not be found. Restart your terminal and run setup.cmd again.'
    }
    Write-Host "  Found Python: $pyExe"

    Write-Host '[3/6] Checking MongoDB Server...'
    $mongodExe = Find-MongodExe
    if (-not $mongodExe) {
        Install-WithWinget -PackageId 'MongoDB.Server' -FriendlyName 'MongoDB Server'
        $mongodExe = Find-MongodExe
    }
    if (-not $mongodExe) {
        throw 'MongoDB Server was installed but mongod.exe could not be found under C:\Program Files\MongoDB.'
    }
    Write-Host "  Found MongoDB: $mongodExe"

    Write-Host '[4/6] Checking MongoDB Shell (mongosh)...'
    $mongoshExe = Find-MongoshExe
    if (-not $mongoshExe) {
        Install-WithWinget -PackageId 'MongoDB.Shell' -FriendlyName 'MongoDB Shell (mongosh)'
        $mongoshExe = Find-MongoshExe
    }
    if (-not $mongoshExe) {
        throw 'mongosh was installed but mongosh.exe could not be found yet. Restart your terminal and run setup.cmd again.'
    }
    Write-Host "  Found mongosh: $mongoshExe"
    if (Get-Process -Name 'mongod' -ErrorAction SilentlyContinue) {
        $wavesActive = $false
        try {
            $ports = Get-NetTCPConnection -LocalPort 3000, 5173 -State Listen -ErrorAction SilentlyContinue
            if ($ports -and @($ports).Count -gt 0) { $wavesActive = $true }
        } catch { }
        if (-not $wavesActive) {
            [void](Invoke-Quiet { & $mongoshExe --quiet 'mongodb://127.0.0.1:27017/?directConnection=true' --eval "db.adminCommand({ shutdown: 1, force: true })" })
        }
    }

    Write-Host '[5/6] Checking nginx...'
    $nginxExe = Find-NginxExe
    if (-not $nginxExe) {
        $installedViaWinget = $false
        $wg = Get-Command 'winget' -ErrorAction SilentlyContinue
        if ($wg) {
            try {
                Write-Host 'Trying to install nginx via winget...'
                & winget install --id 'nginxinc.nginx' -e --source winget --accept-package-agreements --accept-source-agreements
                Refresh-EnvPath
                $nginxExe = Find-NginxExe
                if ($nginxExe) { $installedViaWinget = $true }
            } catch { }
        }
        if (-not $installedViaWinget -and -not $nginxExe) {
            $nginxTarget = 'C:\nginx-1.28.0'
            $zipPath = Join-Path $env:TEMP 'waves-nginx-1.28.0.zip'
            Write-Host "Downloading official nginx for Windows to $nginxTarget..."
            Invoke-WebRequest -Uri 'https://nginx.org/download/nginx-1.28.0.zip' -OutFile $zipPath -UseBasicParsing
            Expand-Archive -Path $zipPath -DestinationPath 'C:\' -Force
            Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
            $nginxExe = Find-NginxExe
        }
    }
    if (-not $nginxExe) {
        throw 'nginx.exe could not be installed automatically. Extract nginx to C:\nginx-1.28.0 and run setup.cmd again.'
    }
    Write-Host "  Found nginx: $nginxExe"

    Write-Host '[6/6] Installing pnpm, Python openpyxl, app packages, folders, and Desktop shortcuts...'
    $pnpmExe = Find-PnpmExe
    if (-not $pnpmExe) {
        # Remove any broken partial npm global pnpm shims left behind by failed npm installs
        Remove-Item -Path "$env:APPDATA\npm\pnpm", "$env:APPDATA\npm\pnpm.cmd", "$env:APPDATA\npm\pnpm.ps1", "$env:APPDATA\npm\node_modules\pnpm" -Recurse -Force -ErrorAction SilentlyContinue
        $wg = Get-Command 'winget' -ErrorAction SilentlyContinue
        if ($wg) {
            try {
                Install-WithWinget -PackageId 'pnpm.pnpm' -FriendlyName 'pnpm'
            } catch { }
            $pnpmExe = Find-PnpmExe
        }
        if (-not $pnpmExe) {
            Write-Host 'Installing pnpm via official standalone script...'
            Invoke-RestMethod -Uri 'https://get.pnpm.io/install.ps1' | Invoke-Expression
            Refresh-EnvPath
            $pnpmExe = Find-PnpmExe
        }
        if (-not $pnpmExe) { throw 'Failed to install pnpm.' }
    }
    Write-Host "  Found pnpm: $pnpmExe"

    & $pyExe -m pip install --upgrade openpyxl
    if ($LASTEXITCODE -ne 0) { throw 'Failed to install Python openpyxl.' }

    Push-Location (Join-Path $Root 'waves-server')
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Failed to install waves-server packages.' }
    Pop-Location

    Push-Location (Join-Path $Root 'waves-app')
    & $pnpmExe install
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Failed to install waves-app packages.' }
    Pop-Location

    if (-not (Test-Path -LiteralPath 'C:\MongoDB')) {
        New-Item -ItemType Directory -Path 'C:\MongoDB' -Force | Out-Null
    }
    $inputDir = Join-Path $Root 'data\input'
    if (-not (Test-Path -LiteralPath $inputDir)) {
        New-Item -ItemType Directory -Path $inputDir -Force | Out-Null
    }

    $desktop = [Environment]::GetFolderPath('Desktop')
    $shell = New-Object -ComObject WScript.Shell

    $wavesLnk = $shell.CreateShortcut((Join-Path $desktop 'Waves.lnk'))
    $wavesLnk.TargetPath = Join-Path $Root 'Waves.cmd'
    $wavesLnk.WorkingDirectory = $Root
    $wavesLnk.Description = 'Launch Waves Orienteering Meet Manager'
    $wavesLnk.Save()

    $inputLnk = $shell.CreateShortcut((Join-Path $desktop 'Waves - Input Folder.lnk'))
    $inputLnk.TargetPath = $inputDir
    $inputLnk.WorkingDirectory = $inputDir
    $inputLnk.Description = 'Drop this meet Excel workbook here before running Waves'
    $inputLnk.Save()

    Write-Host ''
    Write-Host '==========================================================='
    Write-Host ' Setup complete!'
    Write-Host ' Desktop shortcuts created:'
    Write-Host '   - Waves                 (launches everything in one click)'
    Write-Host '   - Waves - Input Folder  (drop Excel start list here)'
    Write-Host '==========================================================='
} catch {
    Write-Host ''
    Write-Host "PROBLEM: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host 'Press Enter to close' | Out-Null
    exit 1
}

Write-Host ''
Read-Host 'Press Enter to close' | Out-Null
