@echo off
REM Author: Roberto Ritter
REM Studio: Cube4Code
REM Website: https://cube4code.com
REM Copyright (c) 2026 Roberto Ritter
REM
REM Gera dist\win-x64\Cube4Notes.exe: arquivo unico, com a interface embutida, que roda em qualquer Windows sem o .NET.
chcp 65001 >nul
cd /d "%~dp0"
REM O Windows nao deixa substituir um .exe em uso: avisa antes de gerar.
tasklist /fi "imagename eq Cube4Notes.exe" /nh 2>nul | find /i "Cube4Notes.exe" >nul
if not errorlevel 1 (
  echo O Cube4Notes esta aberto, e o Windows nao deixa substituir o Cube4Notes.exe em uso.
  echo Feche pelo icone perto do relogio: botao direito, Encerrar Cube4Notes. Depois rode o build.cmd de novo.
  pause
  exit /b 1
)
echo Gerando o Cube4Notes.exe...
dotnet publish Cube4Notes.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true -p:DebugType=none -o dist\win-x64 > build.log 2>&1
if errorlevel 1 (echo FALHOU >> build.log & echo Falhou. Veja build.log) else (echo SUCESSO >> build.log & echo Pronto: dist\win-x64\Cube4Notes.exe)
pause
