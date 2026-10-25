#!/usr/bin/env bash
#
# Safaar Production — AWS EC2 24/7 Prometheus Metrics Agent Setup
#
# Ushbu skript AWS EC2 serverida (safaar-stack) ishga tushirilib,
# minimal (128MB RAM, 0.2 CPU) Prometheus Agent konteynerini ko'taradi.
# U backend metrikalarini 24/7 rejimda Grafana Cloud'ga uzatib turadi.
#
# Ishlatish:
#   scripts/setup-aws-metrics-agent.sh [USERNAME] [TOKEN]
#

set -euo pipefail

USERNAME="${1:-3707287}"
TOKEN="${2:-}"

if [[ -z "$TOKEN" ]]; then
  echo "XATO: Grafana Cloud token kiritilmadi!" >&2
  echo "Ishlatish: $0 <username> <token>" >&2
  exit 1
fi

METRICS_DIR="/home/ubuntu/safaar-stack/metrics"
mkdir -p "$METRICS_DIR"

echo "1. Prometheus Agent konfiguratsiyasi yaratilmoqda..."
cat << EOF > "$METRICS_DIR/prometheus.yml"
global:
  scrape_interval: 15s
  evaluation_interval: 15s

remote_write:
  - url: https://prometheus-prod-66-prod-us-east-3.grafana.net/api/prom/push
    basic_auth:
      username: '${USERNAME}'
      password: '${TOKEN}'

scrape_configs:
  - job_name: 'safaar-backend-prod'
    metrics_path: '/metrics'
    scheme: 'https'
    static_configs:
      - targets: ['api.safaar.uz']
        labels:
          environment: 'production'
          app: 'safaar-backend'
EOF

chmod 600 "$METRICS_DIR/prometheus.yml"

echo "2. Eski agent tekshirilmoqda..."
docker stop safaar-metrics-agent 2>/dev/null || true
docker rm safaar-metrics-agent 2>/dev/null || true

echo "3. Safaar Metrics Agent (Prometheus Agent Mode) ishga tushirilmoqda..."
docker run -d \
  --name safaar-metrics-agent \
  --network safaar-network \
  --restart unless-stopped \
  --memory=128m \
  --cpus=0.2 \
  -v "$METRICS_DIR/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
  prom/prometheus:v2.51.0 \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.agent.path=/tmp/agent-wal \
  --enable-feature=agent

echo "✅ Safaar Metrics Agent muvaffaqiyatli ishga tushirildi!"
docker ps --filter name=safaar-metrics-agent
