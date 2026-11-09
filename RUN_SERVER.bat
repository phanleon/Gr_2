@echo off
title Secure Remote Workspace - Server Admin Edition
chcp 65001 >nul
cd /d "%~dp0"

echo Dang khoi dong SERVER EDITION...
call npm run electron:server
