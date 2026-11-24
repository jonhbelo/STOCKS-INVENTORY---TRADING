@echo off
rem Double-click and leave the window open: every saved change to the app goes live automatically.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0auto-deploy.ps1"
