@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo Half Marathon Training App - Windows one-click local runner
echo ==========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Please install Node.js 20+ first: https://nodejs.org/
  echo After installation, open a new CMD window and run this file again.
  pause
  exit /b 1
)

node scripts\run-local.mjs %*
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [FAILED] One-click runner exited with code: %EXIT_CODE%
  echo If seed fails because tables do not exist, run the 3 SQL files in supabase\migrations in Supabase SQL Editor first.
  echo.
  pause
  exit /b %EXIT_CODE%
)

endlocal
