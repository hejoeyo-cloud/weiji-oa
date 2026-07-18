@echo off
cd /d "%~dp0"

echo ========================================
echo   WeiJi OA - Dependency Installation
echo ========================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python 3.10+ is required but not found.
    echo.
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo Python detected:
python --version
echo.

:: Install dependencies
echo Installing dependencies...
pip install -r backend\requirements.txt

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Dependency installation failed.
    echo Try running this script as Administrator,
    echo or check your internet connection.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Installation complete!
echo   Double-click start.bat to launch.
echo ========================================
echo.

pause
