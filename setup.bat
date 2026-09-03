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

:: Terminate any running instance of the app so Windows doesn't lock the .exe file
echo [1/4] Closing any running Genesys POS background instances...
taskkill /F /IM GenesysPOS_Standalone.exe >nul 2>&1
taskkill /F /IM GenesysInventory.exe >nul 2>&1

:: Clean old distribution files
if exist dist (
    echo Cleaning previous build artifacts...
    rmdir /s /q dist >nul 2>&1
)

echo.
echo [2/4] Verifying and installing dependencies...
call npm install --no-fund --no-audit

echo.
echo [3/4] Compiling frontend (with Barcode Suite) and backend...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Please review the error above.
    pause
    exit /b 1
)

echo.
echo [4/4] Generating standalone Windows Executable (GenesysPOS_Standalone.exe)...
call npx pkg dist/server.cjs --config package.json --targets node18-win-x64 --output GenesysPOS_Standalone.exe
if %errorlevel% neq 0 (
    echo [ERROR] Standalone packaging failed!
    pause
    exit /b 1
)

echo.
echo ===================================================
echo   BUILD COMPLETED SUCCESSFULLY!
echo ===================================================
echo Standalone App: GenesysPOS_Standalone.exe
echo Features included:
echo  - Live Barcode Scanning (USB, Bluetooth, Camera, Manual)
echo  - Product Barcode Labels & Shelf Tags (Code 128)
echo  - POS Global Scanner Integration & Sound Feedback
echo  - Shop & Warehouse Multi-Inventory Engine
echo.
echo Launching GenesysPOS_Standalone.exe...
start "" "%~dp0GenesysPOS_Standalone.exe"
echo.
pause

