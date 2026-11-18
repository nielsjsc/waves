@echo off
cd /d "%~dp0"
title Waves
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\waves-manager.ps1" -Mode run
