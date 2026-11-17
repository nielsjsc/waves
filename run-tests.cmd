@echo off
setlocal
cd /d "%~dp0waves-app"

if not exist "node_modules" (
    echo Installing test dependencies ^(first-time setup^)...
    call pnpm install
)

echo ============================================================
echo [1/3] Running Waves Unit ^& Data-Integrity Tests (Vitest)...
echo ============================================================
call pnpm test:ci
if errorlevel 1 (
    echo.
    echo [FAIL] Unit ^& Data-Integrity tests failed!
    exit /b 1
)

echo.
echo ============================================================
echo [2/3] Running Multi-Station E2E Meet Simulation (Playwright)...
echo ============================================================
call pnpm test:e2e:ci
if errorlevel 1 (
    echo.
    echo [FAIL] Multi-Station E2E simulation failed!
    exit /b 1
)

echo.
echo ============================================================
echo [3/3] Verifying Production Bundle Build (Vite)...
echo ============================================================
call pnpm build
if errorlevel 1 (
    echo.
    echo [FAIL] Production build failed!
    exit /b 1
)

echo.
echo ============================================================
echo [PASS] All Waves automated tests and production build passed!
echo ============================================================
