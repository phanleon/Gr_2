@echo off
title Secure Remote Workspace - Zero-Trust System
chcp 65001 >nul
cd /d "%~dp0"

echo ================================================================
echo   Secure Remote Workspace & Zero-Trust SSH/Desktop System
echo   Author: Phan Minh Nhut
echo ================================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay Node.js tren may tinh!
  echo Vui long cai dat Node.js LTS tu: https://nodejs.org/
  echo Sau khi cai dat xong, hay chay lai file nay.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/2] Dang cai dat cac thu vien du an...
  echo Qua trinh co the mat vai phut tuy toc do mang...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [LOI] npm install that bai! Vui long kiem tra mang.
    pause
    exit /b 1
  )
)

echo [2/2] Dang khoi dong Secure Remote Workspace...
echo.
call npm run electron:server
