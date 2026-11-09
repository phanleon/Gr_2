@echo off
title Auto Lesson Auto-Save V4 - Trợ lý tải bài học tự động
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================================
echo   Auto Lesson Auto-Save V4 — Full Auto Downloader
echo ========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay Node.js tren may tinh!
  echo Vui long cai dat Node.js tu: https://nodejs.org/
  echo Sau khi cai dat xong, hay chay lai file nay.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\electron" (
  echo [1/2] Dang cai dat cac thu vien (Electron, FFmpeg)...
  echo Lan dau tien co the mat vai phut tuy vao toc do mang...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [LOI] Cai dat that bai! Vui long kiem tra ket noi mang.
    pause
    exit /b 1
  )
)

echo [2/2] Dang khoi dong ung dung...
echo.
call npm start

if errorlevel 1 (
  echo.
  echo Chuong trinh ket thuc.
  pause
)
