@echo off
title Secure Remote Workspace - Client Edition
chcp 65001 >nul
cd /d "%~dp0"

echo Dang khoi dong CLIENT EDITION...
call npm run electron:client
