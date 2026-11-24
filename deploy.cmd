@echo off
rem Double-click to push the app to Apps Script and deploy a new version (same link).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1"
