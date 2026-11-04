@echo off
title Auto Lesson Auto-Save V3
cd /d "%~dp0"

if not exist "node_modules\electron" (
  echo Chua co node_modules. Dang chay npm install...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

call npm start
