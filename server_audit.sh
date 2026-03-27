#!/bin/bash
echo "============================================"
echo "  FlipSlab - Server Resource Audit"
echo "============================================"
echo ""

echo "============================================"
echo "  1. WEBSITES IN APACHE"
echo "============================================"
httpd -S 2>&1 | head -50
echo ""

echo "============================================"
echo "  2. RUNNING SERVICES"
echo "============================================"
systemctl list-units --type=service --state=running | grep -v "systemd\|dbus\|ssh\|cron\|network\|snap\|getty"
echo ""

echo "============================================"
echo "  3. ACTIVE APPS (Python/Node)"
echo "============================================"
ps aux | grep -E "python|node|uvicorn|gunicorn|pm2" | grep -v grep
echo ""

echo "============================================"
echo "  4. PORTS IN USE"
echo "============================================"
ss -tlnp | grep "LISTEN"
echo ""

echo "============================================"
echo "  5. APP FOLDERS IN /opt"
echo "============================================"
ls -la /opt/
echo ""

echo "============================================"
echo "  6. DISK USAGE PER APP"
echo "============================================"
du -sh /opt/*/ 2>/dev/null
du -sh /home/*/ 2>/dev/null
echo ""

echo "============================================"
echo "  7. TOP 20 MEMORY CONSUMERS"
echo "============================================"
ps aux --sort=-%mem | head -20
echo ""

echo "============================================"
echo "  Audit complete!"
echo "============================================"
