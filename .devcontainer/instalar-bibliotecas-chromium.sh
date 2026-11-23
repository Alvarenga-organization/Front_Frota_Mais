#!/usr/bin/env bash
# Bibliotecas de sistema exigidas pelo chrome-headless-shell do Puppeteer (testes Karma)
# no Ubuntu 24.04. Lista obtida com `ldd` no binário; nada além do necessário.
set -euo pipefail

PACOTES=(
  libnss3 libnspr4
  libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64
  libdrm2 libgbm1 libxkbcommon0
  libx11-6 libxext6 libxi6 libxcomposite1 libxdamage1 libxfixes3 libxrandr2
  libasound2t64 libdbus-1-3
)

if dpkg -s "${PACOTES[@]}" >/dev/null 2>&1; then
  echo "Bibliotecas do Chromium já instaladas."
  exit 0
fi

sudo apt-get update
sudo apt-get install -y --no-install-recommends "${PACOTES[@]}"
