@echo off
cd /d "%~dp0"
echo.
echo ===== Waves: make start list =====
where py >nul 2>nul
if %errorlevel%==0 (
    py startsheet_to_csv.py
) else (
    where python >nul 2>nul
    if errorlevel 1 (
        echo PROBLEM: Python is not installed on this computer.
        echo Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
        goto end
    )
    python startsheet_to_csv.py
)
:end
echo.
pause
