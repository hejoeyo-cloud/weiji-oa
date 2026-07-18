@echo off
cd /d "%~dp0"

echo ========================================
echo   WeiJi OA System Startup
echo ========================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.10+ first.
    echo         Run install.bat to set up dependencies.
    pause
    exit /b 1
)

:: Check dependencies
python -c "import fastapi" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Dependencies not installed. Run install.bat first.
    pause
    exit /b 1
)

:: Start server
echo Starting server...
start /b python main.py

:: Wait for server to be ready
echo Waiting for server to start...
timeout /t 5 /nobreak >nul

:: Show access info
echo.
echo ========================================
echo   Server is running!
echo.
echo   Local:  http://localhost:8000
echo   LAN:    http://%COMPUTERNAME%:8000
echo.
echo   Close this window to stop the server.
echo ========================================
echo.

pause
