@echo off
setlocal
echo ===================================================
echo   Genesys POS - Windows Standalone Builder        
echo ===================================================
echo.

:: Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT installed!
    echo.
    echo To build your .exe, you need Node.js.
    echo 1. Go to https://nodejs.org/
    echo 2. Download and install the "LTS" version.
    echo 3. Run this setup.bat again.
    echo.
    pause
    exit /b 1
)

echo [1/3] Preparing project...
call npm install --no-fund --no-audit

echo.
echo [2/3] Building application source...
call npm run build

echo.
echo [3/3] Creating Windows Executable (GenesysPOS_Standalone.exe)...
echo This may take a moment...
call npx pkg . --targets node18-win-x64 --output GenesysPOS_Standalone.exe

echo.
echo ===================================================
echo   SUCCESS! 
echo ===================================================
echo Your application is ready: GenesysPOS_Standalone.exe
echo.
echo You can now move this .exe anywhere and run it!
echo.
pause
