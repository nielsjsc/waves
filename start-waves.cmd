@echo off
cd /d "%~dp0"
set "ROOT=%~dp0"

rem ===== Settings: change these only if MongoDB or nginx are installed somewhere else =====
set "MONGOD=C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe"
set "MONGO_DATA=C:\MongoDB"
set "NGINX_DIR=C:\nginx-1.30.5"
rem ========================================================================================
set "MONGO_URL=mongodb://127.0.0.1:27017/?directConnection=true"

echo.
echo ===== Waves: start =====
echo.

if not exist "%MONGOD%" goto no_mongod
if not exist "%NGINX_DIR%\nginx.exe" goto no_nginx
where mongosh >nul 2>nul
if errorlevel 1 goto no_mongosh
where pnpm >nul 2>nul
if errorlevel 1 goto no_pnpm

tasklist /fi "imagename eq mongod.exe" 2>nul | find /i "mongod.exe" >nul
if not errorlevel 1 goto already_running

if not exist "%MONGO_DATA%" mkdir "%MONGO_DATA%"

if not exist "%ROOT%waves-server\node_modules" (
    echo Installing sync server dependencies ^(first-time setup^)...
    pushd "%ROOT%waves-server"
    call npm install
    popd
)
if not exist "%ROOT%waves-app\node_modules" (
    echo Installing app dependencies ^(first-time setup^)...
    pushd "%ROOT%waves-app"
    call pnpm install
    popd
)

echo [1/5] Starting the database...
start "Waves - database (leave open)" "%MONGOD%" --dbpath="%MONGO_DATA%" --bind_ip=127.0.0.1 --port=27017 --replSet=rs0
set /a tries=0
:wait_mongo
set /a tries+=1
mongosh --quiet "%MONGO_URL%" --eval "db.runCommand({ping:1}).ok" >nul 2>nul
if not errorlevel 1 goto mongo_up
if %tries% geq 30 goto mongo_failed
timeout /t 2 /nobreak >nul
goto wait_mongo

:mongo_up
echo [2/5] Checking the database set-up...
mongosh --quiet "%MONGO_URL%" --eval "try { rs.status().ok } catch (e) { rs.initiate({ _id: 'rs0', members: [ { _id: 0, host: 'localhost:27017' } ] }) }" >nul 2>nul
set /a tries=0
:wait_primary
set /a tries+=1
mongosh --quiet "%MONGO_URL%" --eval "if (!db.hello().isWritablePrimary) { quit(1) }" >nul 2>nul
if not errorlevel 1 goto primary_up
if %tries% geq 30 goto primary_failed
timeout /t 2 /nobreak >nul
goto wait_primary

:primary_up
echo [3/5] Starting the sync server (this can take up to a minute)...
start "Waves - sync server (leave open)" /d "%ROOT%waves-server" cmd /c "npx ts-node server.ts & exit 0"
set /a tries=0
:wait_server
set /a tries+=1
curl --silent --output nul --max-time 2 -g "http://[::1]:3000/" >nul 2>nul
if not errorlevel 1 goto server_up
if %tries% geq 45 goto server_failed
timeout /t 2 /nobreak >nul
goto wait_server

:server_up
echo [4/5] Starting the web server...
start "" "%NGINX_DIR%\nginx.exe" -p "%NGINX_DIR%" -c "%ROOT%waves-server\nginx.conf"

echo [5/5] Starting the app...
start "Waves - app (leave open)" /d "%ROOT%waves-app" cmd /c "pnpm dev & exit 0"
set /a tries=0
:wait_app
set /a tries+=1
curl --silent --output nul --max-time 2 http://localhost:5173/ >nul 2>nul
if not errorlevel 1 goto app_up
if %tries% geq 30 goto app_failed
timeout /t 2 /nobreak >nul
goto wait_app

:app_up
echo.
echo ===========================================================
echo  Waves is running.
echo  Leave the black windows open (you can minimize them).
echo  Your browser will open Waves now.
echo ===========================================================
start "" "http://localhost"
goto end

:no_mongod
echo PROBLEM: MongoDB was not found at:
echo   %MONGOD%
echo Ask the organizer to check the settings at the top of start-waves.cmd.
goto end
:no_nginx
echo PROBLEM: nginx was not found at:
echo   %NGINX_DIR%
echo Ask the organizer to check the settings at the top of start-waves.cmd.
goto end
:no_mongosh
echo PROBLEM: the MongoDB shell ("mongosh") is not installed or not in the PATH.
goto end
:no_pnpm
echo PROBLEM: "pnpm" is not installed or not in the PATH.
goto end
:already_running
echo Waves looks like it is already running (or was not shut down).
echo Double-click stop-waves.cmd first, then run this again. No data is lost.
goto end
:mongo_failed
echo PROBLEM: the database did not start. Look at the window titled "Waves - database".
goto end
:primary_failed
echo PROBLEM: the database started but did not become ready. Run stop-waves.cmd and try again.
goto end
:server_failed
echo PROBLEM: the sync server did not start. Look at the window titled "Waves - sync server".
goto end
:app_failed
echo PROBLEM: the app did not start. Look at the window titled "Waves - app".

:end
echo.
pause
