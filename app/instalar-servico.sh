#!/usr/bin/env bash
# Author: Roberto Ritter
# Studio: Cube4Code
# Website: https://cube4code.com
# Copyright (c) 2026 Roberto Ritter
#
# Instala (ou atualiza) o Cube4Notes como serviço do systemd num servidor Linux sem tela: copia o executável
# gerado por gerar-executavel.sh para /opt/cube4notes, cria o serviço "cube4notes" que roda com o seu usuário
# (as notas e a configuração ficam nas pastas dele) e inicia junto com a máquina.
# Uso: ./instalar-servico.sh            (porta padrão 43125)
#      ./instalar-servico.sh --port 43200
set -euo pipefail
cd "$(dirname "$0")"

user="${SUDO_USER:-$USER}"
if [ "$user" = "root" ]; then echo "Rode com o seu usuário (o script pede sudo quando precisa); o serviço não deve rodar como root."; exit 1; fi
bin=$(ls -t dist/linux-*/Cube4Notes 2>/dev/null | head -1 || true)
if [ -z "$bin" ]; then echo "Gere o executável antes: ./gerar-executavel.sh"; exit 1; fi
extra="${*:-}"
lang="${LANG:-C.UTF-8}"

echo "Instalando $bin em /opt/cube4notes (serviço com o usuário $user)..."
sudo mkdir -p /opt/cube4notes
sudo systemctl stop cube4notes 2>/dev/null || true
sudo install -m 755 "$bin" /opt/cube4notes/Cube4Notes

sudo tee /etc/systemd/system/cube4notes.service >/dev/null <<UNIT
[Unit]
Description=Cube4Notes (notas em Markdown para os aparelhos da rede local)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$user
ExecStart=/opt/cube4notes/Cube4Notes --sem-janela --sem-navegador $extra
Environment=LANG=$lang
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
started=$(date "+%Y-%m-%d %H:%M:%S")
sudo systemctl enable cube4notes >/dev/null 2>&1
sudo systemctl restart cube4notes
sleep 4
echo
echo "Serviço instalado. Últimas mensagens do Cube4Notes:"
sudo journalctl -u cube4notes --since "$started" --no-pager -o cat | grep -v "^Started \|^Stopped \|Consumed "
if ! systemctl is-active --quiet cube4notes; then echo; echo "O serviço não ficou rodando. Veja as mensagens acima ou: journalctl -u cube4notes -n 80"; exit 1; fi
echo
echo "Ver de novo: journalctl -u cube4notes -f    Parar: sudo systemctl stop cube4notes    Atualizar: gere de novo e rode este script."
