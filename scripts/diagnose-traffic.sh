#!/bin/bash
# Diagnostico de trafico y recursos del VPS
# Ejecutar: bash scripts/diagnose-traffic.sh

echo "========== DIAGNOSTICO REPITELA VPS =========="
echo "Fecha: $(date)"
echo ""

echo "=== TOP PROCESOS POR MEMORIA ==="
ps aux --sort=-%mem | head -10
echo ""

echo "=== TOP PROCESOS POR CPU ==="
ps aux --sort=-%cpu | head -10
echo ""

echo "=== DOCKER CONTAINERS ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Size}}" 2>/dev/null || echo "Docker no disponible"
echo ""

echo "=== DOCKER STATS (snapshot) ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null || echo "Docker no disponible"
echo ""

echo "=== CONEXIONES DE RED ACTIVAS ==="
ss -tunapl 2>/dev/null | grep -v "^Netid" | awk '{print $1, $5, $6}' | sort | uniq -c | sort -rn | head -20
echo ""

echo "=== SERVICIOS ESCUCHANDO ==="
ss -tlnp 2>/dev/null | grep LISTEN
echo ""

echo "=== TRAFICO POR INTERFAZ ==="
cat /proc/net/dev 2>/dev/null | grep -v "lo:" | tail -5
echo ""

echo "=== CRON JOBS ACTIVOS ==="
crontab -l 2>/dev/null || echo "Sin cron jobs"
echo ""
for user in $(cut -f1 -d: /etc/passwd); do
  jobs=$(crontab -u "$user" -l 2>/dev/null | grep -v "^#" | grep -v "^$")
  if [ -n "$jobs" ]; then
    echo "Cron de $user:"
    echo "$jobs"
  fi
done
echo ""

echo "=== SYSTEMD TIMERS (tareas programadas) ==="
systemctl list-timers --no-pager 2>/dev/null | head -15
echo ""

echo "=== APT AUTO-UPDATES ==="
cat /etc/apt/apt.conf.d/20auto-upgrades 2>/dev/null || echo "No configurado"
echo ""

echo "=== DISCO ==="
df -h / 2>/dev/null
echo ""

echo "=== DOCKER IMAGES (espacio) ==="
docker system df 2>/dev/null || echo "Docker no disponible"
echo ""

echo "=== LOGS GRANDES ==="
find /var/log -type f -size +10M -exec ls -lh {} \; 2>/dev/null | head -10
echo ""

echo "========== FIN DIAGNOSTICO =========="
