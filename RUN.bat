@echo off
title Auto Lesson Auto-Save V4
chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules\electron" (
  echo [!] Chua co thu vien. Dang tu dong chay cai dat...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

call npm start
