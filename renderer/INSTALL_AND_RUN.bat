@echo off
title Auto Lesson Auto-Save V3
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [LOI] Chua tim thay Node.js.
  echo Hay cai Node.js LTS roi chay lai file nay.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo.
  echo Dang cai Electron + FFmpeg...
  echo Lan dau can Internet va co the mat vai phut.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [LOI] npm install that bai.
    pause
    exit /b 1
  )
)

echo.
echo Dang mo Auto Lesson Auto-Save V3...
call npm start

if errorlevel 1 (
  echo.
  echo Chuong trinh ket thuc voi loi.
  pause
)
