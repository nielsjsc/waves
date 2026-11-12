@echo off
cd /d "%~dp0"
set "NGINX_DIR=C:\nginx-1.30.5"
set "MONGO_URL=mongodb://127.0.0.1:27017/?directConnection=true"

echo.
echo ===== Waves: stop =====
echo.

echo Closing the app and the sync server...
call :kill_port 5173
call :kill_port 3000
taskkill /fi "windowtitle eq Waves - app*" /f >nul 2>nul
taskkill /fi "windowtitle eq Waves - sync server*" /f >nul 2>nul

echo Closing the web server...
taskkill /im nginx.exe /f >nul 2>nul

echo Calculating total people on the course...
where py >nul 2>nul
if %errorlevel%==0 (
    py count_people_on_course.py
) else (
    where python >nul 2>nul
    if %errorlevel%==0 (
        python count_people_on_course.py
    )
)

echo Closing the database (this takes a few seconds)...
mongosh --quiet "%MONGO_URL%" --eval "db.getSiblingDB('admin').shutdownServer()" >nul 2>nul
set /a tries=0
:wait_mongo_stop
tasklist /fi "imagename eq mongod.exe" 2>nul | find /i "mongod.exe" >nul
if errorlevel 1 goto stopped
set /a tries+=1
if %tries% geq 15 goto force_mongo
timeout /t 2 /nobreak >nul
goto wait_mongo_stop

:force_mongo
echo The database did not close by itself, so it is being closed now.
taskkill /im mongod.exe /f >nul 2>nul

:stopped
echo.
echo ===========================================================
echo  Waves is stopped. Your data is saved.
echo ===========================================================
echo.
pause
goto :eof

:kill_port
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%1 .*LISTENING"') do taskkill /fi "PID eq %%p" /fi "IMAGENAME eq node.exe" /t /f >nul 2>nul
exit /b
