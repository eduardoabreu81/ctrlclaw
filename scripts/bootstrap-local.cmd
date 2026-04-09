@echo off
REM Bootstrap script for CtrlClaw local setup
REM Note: This is a manual helper. A fully guided install flow is planned but not yet available.

echo ==========================================
echo CtrlClaw Local Bootstrap
echo ==========================================
echo.
echo WARNING: Default credentials (if any) must be changed after first login.
echo This setup is for local development only.
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed. Please install Node.js first.
    exit /b 1
)

echo [1/4] Node.js found

REM Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: package.json not found. Please run this script from the project root.
    exit /b 1
)

echo [2/4] Project root verified

REM Install dependencies
if not exist "node_modules" (
    echo [3/4] Installing dependencies...
    call npm install
) else (
    echo [3/4] Dependencies already installed (skipped)
)

REM Create .env if not exists
if not exist ".env" (
    if exist ".env.example" (
        echo [4/4] Creating .env from .env.example...
        copy .env.example .env
        echo       Please review and update .env with your configuration.
    ) else (
        echo [4/4] No .env.example found. You may need to configure environment variables manually.
    )
) else (
    echo [4/4] .env already exists (skipped)
)

echo.
echo ==========================================
echo Bootstrap complete!
echo ==========================================
echo.
echo Next steps:
echo   1. Review your .env configuration
echo   2. Start the WebSocket server:
echo      node scripts/start-ws-server.js
echo   3. In another terminal, start the web app:
echo      npm start
echo.
echo IMPORTANT: If your setup uses default credentials, change them immediately after first login.
echo.
