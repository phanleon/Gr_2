@echo off
title Secure Remote Workspace - Zero-Trust System
chcp 65001 >nul
cd /d "%~dp0"

echo ================================================================
echo   Secure Remote Workspace ^& Zero-Trust SSH/Desktop System
echo   Enterprise Edition - Open Source Solution
echo ================================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js runtime was not found on your system!
  echo Please install Node.js LTS from: https://nodejs.org/
  echo After completing the installation, please run this script again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/2] Installing required project dependencies...
  echo This process may take a few minutes depending on your network connection...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed! Please check your network connection and retry.
    pause
    exit /b 1
  )
)

echo [2/2] Launching Secure Remote Workspace Server Edition...
echo.
call npm run electron:server
