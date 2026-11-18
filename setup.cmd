@echo off
cd /d "%~dp0"
title Waves - First-Time Laptop Setup
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1"
