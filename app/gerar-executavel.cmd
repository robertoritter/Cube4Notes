@echo off
REM Author: Roberto Ritter
REM Studio: Cube4Code
REM Website: https://cube4code.com
REM Copyright (c) 2026 Roberto Ritter
REM
REM Gera dist\win-x64\Cube4Notes.exe: arquivo unico, com a interface embutida, que roda em qualquer Windows sem o .NET.
chcp 65001 >nul
cd /d "%~dp0"
echo Gerando o Cube4Notes.exe...
dotnet publish Cube4Notes.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:DebugType=none -o dist\win-x64 > gerar-executavel.log 2>&1
if errorlevel 1 (echo FALHOU >> gerar-executavel.log & echo Falhou. Veja gerar-executavel.log) else (echo SUCESSO >> gerar-executavel.log & echo Pronto: dist\win-x64\Cube4Notes.exe)
pause
