@ECHO OFF

ECHO "Starting MongoDB"
cd mongo
start start.cmd
cd ..

timeout /t 5 /nobreak

ECHO "Starting Rx-Server"
cd rxserver
start start.cmd
cd ..

timeout /t 20 /nobreak

ECHO "Starting nginx"
cd nginx
start start.cmd
cd ..

ECHO "Starting Vite Application"
cd app
start start.cmd
cd ..

timeout /t 3 /nobreak

ECHO "Ready"


