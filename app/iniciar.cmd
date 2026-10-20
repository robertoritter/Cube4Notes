@echo off
REM Author: Roberto Ritter
REM Studio: Cube4Code
REM Website: https://cube4code.com
REM Copyright (c) 2026 Roberto Ritter
REM
REM Inicia o Cube4Notes Server no Windows (compila e roda com o .NET 10 SDK).
chcp 65001 >nul
title Cube4Notes
cd /d "%~dp0"
where dotnet >nul 2>nul
if errorlevel 1 (
  echo O .NET 10 SDK nao foi encontrado. Instale em https://dotnet.microsoft.com/download
  pause
  exit /b 1
)
dotnet run -c Release -- %*
if errorlevel 1 pause
