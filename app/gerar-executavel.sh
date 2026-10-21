#!/usr/bin/env bash
# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Gera o Cube4Notes para Linux (x64 ou arm64, conforme esta máquina) ou macOS: arquivo único, com a interface
# embutida, que roda sem o .NET instalado. Resultado em dist/<plataforma>/Cube4Notes.
# Uso: ./gerar-executavel.sh            (plataforma desta máquina)
#      ./gerar-executavel.sh linux-arm64 (outra plataforma: linux-x64, linux-arm64, osx-arm64, osx-x64)
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v dotnet >/dev/null 2>&1 && [ -x "$HOME/.dotnet/dotnet" ]; then export PATH="$HOME/.dotnet:$PATH"; fi
if ! command -v dotnet >/dev/null 2>&1; then
  echo "O .NET 10 SDK não foi encontrado. Para instalar só para este usuário:"
  echo "  curl -sSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 10.0"
  echo "  export PATH=\"\$HOME/.dotnet:\$PATH\""
  exit 1
fi

# O Cube4Notes não usa a biblioteca ICU (globalização invariante); o .NET SDK também não precisa dela para compilar.
# Sem isso, o dotnet para logo no início em sistemas sem libicu (por exemplo um Debian mínimo).
export DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1

rid="${1:-}"
if [ -z "$rid" ]; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) rid=linux-x64 ;;
    Linux-aarch64|Linux-arm64) rid=linux-arm64 ;;
    Darwin-arm64) rid=osx-arm64 ;;
    Darwin-x86_64) rid=osx-x64 ;;
    *) echo "Plataforma não reconhecida: $(uname -s) $(uname -m). Informe uma: linux-x64, linux-arm64, osx-arm64, osx-x64"; exit 1 ;;
  esac
fi

echo "Gerando o Cube4Notes para $rid..."
if dotnet publish Cube4Notes.csproj -c Release -r "$rid" --self-contained true \
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:EnableCompressionInSingleFile=true \
    -p:DebugType=none -o "dist/$rid" > gerar-executavel.log 2>&1; then
  echo "SUCESSO" >> gerar-executavel.log
  chmod +x "dist/$rid/Cube4Notes"
  echo "Pronto: dist/$rid/Cube4Notes"
else
  echo "FALHOU" >> gerar-executavel.log
  tail -20 gerar-executavel.log
  echo "Falhou. Veja gerar-executavel.log"
  exit 1
fi
