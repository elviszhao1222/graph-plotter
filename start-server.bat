@echo off
echo ========================================
echo   Graph Plotter - Server Startup
echo ========================================
echo.

cd /d "%~dp0"

REM Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check and kill processes using ports 3000 and 5174
echo Checking for existing servers on ports 3000 and 5174...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    echo Stopping process %%a using port 3000...
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5174.*LISTENING"') do (
    echo Stopping process %%a using port 5174...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

REM Start backend server
echo [1/2] Starting backend server...
cd backend
if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install backend dependencies!
        pause
        exit /b 1
    )
)
start "Graph Plotter - Backend" cmd /k "cd /d %~dp0backend && (npm start || (echo. && echo Backend server stopped with error. && echo Press any key to close this window... && pause >nul))"
cd ..

REM Wait a moment for backend to start
echo Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

REM Start frontend server
echo [2/2] Starting frontend server...
cd /d "%~dp0"

REM Try Python (check py, python, python3 in order)
REM Test if py command works by trying to run it
py --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Using Python launcher (py)...
    start "Graph Plotter - Frontend" cmd /k "cd /d %~dp0 && (py -m http.server 5174 || (echo. && echo Frontend server stopped with error. && echo Press any key to close this window... && pause >nul))"
    goto :frontend_started
)

python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Using Python (python)...
    start "Graph Plotter - Frontend" cmd /k "cd /d %~dp0 && (python -m http.server 5174 || (echo. && echo Frontend server stopped with error. && echo Press any key to close this window... && pause >nul))"
    goto :frontend_started
)

python3 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Using Python3 (python3)...
    start "Graph Plotter - Frontend" cmd /k "cd /d %~dp0 && (python3 -m http.server 5174 || (echo. && echo Frontend server stopped with error. && echo Press any key to close this window... && pause >nul))"
    goto :frontend_started
)

REM Fallback to Node.js http-server
echo Python not found, trying Node.js http-server...
npx --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Using npx http-server...
    start "Graph Plotter - Frontend" cmd /k "cd /d %~dp0 && (npx http-server -p 5174 -c-1 || (echo. && echo Frontend server stopped with error. && echo Press any key to close this window... && pause >nul))"
    goto :frontend_started
)

echo ERROR: Neither Python (py/python/python3) nor npx found.
echo Please install Python from https://www.python.org/ or ensure Node.js is installed.
pause
exit /b 1

:frontend_started
echo Frontend server starting in new window...
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Servers are starting...
echo ========================================
echo.
echo Backend API:  http://localhost:3000
echo Frontend App: http://localhost:5174
echo.
echo Two new windows have been opened:
echo   - "Graph Plotter - Backend"  (Node.js server)
echo   - "Graph Plotter - Frontend" (HTTP server)
echo.
echo Open your browser and navigate to:
echo   http://localhost:5174
echo.
echo Press any key to close this window...
echo (The servers will continue running in their own windows)
pause >nul

