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
    foreach ($extra in @("$env:APPDATA\npm", "$env:LOCALAPPDATA\pnpm", 'C:\Program Files\nodejs')) {
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

function Find-PythonExe {
    foreach ($name in @('py', 'python')) {
        $c = Get-Command $name -ErrorAction SilentlyContinue
        if ($c) { return $c.Source }
    }
    $localPy = Get-ChildItem -Path "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($localPy) { return $localPy.FullName }
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
    $patterns = @('C:\nginx\nginx.exe', 'C:\nginx*\nginx.exe', 'C:\Program Files\nginx*\nginx.exe', "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\*nginx*\**\nginx.exe")
    $hits = @()
    foreach ($pat in $patterns) {
        $hits += Get-ChildItem -Path $pat -ErrorAction SilentlyContinue
    }
    $best = $hits | Sort-Object FullName -Descending | Select-Object -First 1
    if ($best) { return $best.FullName }
    $c = Get-Command 'nginx' -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
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
    if (-not (Get-Command 'pnpm' -ErrorAction SilentlyContinue)) {
        & npm.cmd install -g pnpm
        if ($LASTEXITCODE -ne 0) { throw 'Failed to install pnpm.' }
        Refresh-EnvPath
    }

    & $pyExe -m pip install --upgrade openpyxl
    if ($LASTEXITCODE -ne 0) { throw 'Failed to install Python openpyxl.' }

    Push-Location (Join-Path $Root 'waves-server')
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'Failed to install waves-server packages.' }
    Pop-Location

    Push-Location (Join-Path $Root 'waves-app')
    & pnpm.cmd install
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
