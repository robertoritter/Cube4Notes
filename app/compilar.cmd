@echo off
REM Author: Roberto Ritter
REM Studio: Cube4Code
REM Website: https://cube4code.com
REM Copyright (c) 2026 Roberto Ritter
REM
REM Compila o Cube4Notes Server sem parar o servidor em execução e grava o resultado em compilar.log.
chcp 65001 >nul
cd /d "%~dp0"
echo Compilando o Cube4Notes...
dotnet build Cube4Notes.csproj -c Release -nologo -o obj\verificacao > compilar.log 2>&1
if errorlevel 1 (echo FALHOU >> compilar.log & echo Falhou. Veja compilar.log) else (echo SUCESSO >> compilar.log & echo Compilou sem erros.)
timeout /t 4 >nul
