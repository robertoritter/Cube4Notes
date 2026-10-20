<#
  Author: Roberto Ritter
  Studio: Cube4Code
  Website: https://cube4code.com
  Copyright (c) 2026 Roberto Ritter

  Gera uma pasta com Cube4Notes.exe que roda em outro Windows sem o .NET instalado.
#>
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$out = Join-Path $here 'dist\win-x64'
dotnet publish (Join-Path $here 'Cube4Notes.csproj') -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $out
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o executável.' }
Write-Host "Pronto: $(Join-Path $out 'Cube4Notes.exe') (mantenha a pasta wwwroot ao lado dele)"
