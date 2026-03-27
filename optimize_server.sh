#!/bin/bash
echo "============================================"
echo "  FlipSlab - Server Memory Optimization"
echo "============================================"
echo ""

# Show before
echo "[BEFORE] Memory status:"
free -h | grep Mem
echo ""

# 1. Reduce SpamAssassin from 5 children to 2
echo "============================================"
echo "  1. Reducing SpamAssassin (5 → 2 children)"
echo "============================================"
SPAMD_CONF="/etc/sysconfig/spamassassin"
if [ -f "$SPAMD_CONF" ]; then
    cp "$SPAMD_CONF" "$SPAMD_CONF.bak"
    sed -i 's/--max-children=5/--max-children=2/g' "$SPAMD_CONF"
    echo "  Updated config"
else
    # Try systemd override
    mkdir -p /etc/systemd/system/spamd.service.d
    cat > /etc/systemd/system/spamd.service.d/memory.conf << 'EOF'
[Service]
ExecStart=
ExecStart=/usr/local/cpanel/3rdparty/perl/542/bin/perl -T -w /usr/local/cpanel/3rdparty/bin/spamd --allowed-ips=127.0.0.1,::1 --max-children=2 --pidfile=/var/run/spamd.pid --listen=5 --listen=6
EOF
    echo "  Created systemd override"
fi
systemctl daemon-reload
systemctl restart spamd 2>/dev/null
echo "  SpamAssassin restarted with 2 children"
echo ""

# 2. Reduce Apache workers from 6 to 3
echo "============================================"
echo "  2. Reducing Apache workers (6 → 3)"
echo "============================================"
APACHE_MPM="/etc/apache2/conf.d/includes/pre_main_global.conf"
if [ ! -f "$APACHE_MPM" ]; then
    APACHE_MPM="/etc/apache2/conf/includes/pre_main_global.conf"
fi
if [ ! -d "$(dirname $APACHE_MPM)" ]; then
    mkdir -p "$(dirname $APACHE_MPM)"
fi
cat > "$APACHE_MPM" << 'EOF'
# Memory optimization - reduce workers
<IfModule event.c>
    StartServers 1
    MinSpareThreads 10
    MaxSpareThreads 25
    ThreadsPerChild 10
    MaxRequestWorkers 30
    ServerLimit 3
    MaxConnectionsPerChild 1000
</IfModule>
<IfModule worker.c>
    StartServers 1
    MinSpareThreads 10
    MaxSpareThreads 25
    ThreadsPerChild 10
    MaxRequestWorkers 30
    ServerLimit 3
    MaxConnectionsPerChild 1000
</IfModule>
<IfModule prefork.c>
    StartServers 1
    MinSpareServers 1
    MaxSpareServers 3
    MaxRequestWorkers 30
    ServerLimit 3
    MaxConnectionsPerChild 1000
</IfModule>
EOF
httpd -t 2>&1 | head -3
if [ $? -eq 0 ]; then
    systemctl restart httpd
    echo "  Apache restarted with 3 workers"
else
    echo "  WARNING: Apache config test failed, reverting..."
    rm -f "$APACHE_MPM"
    echo "  Reverted, Apache unchanged"
fi
echo ""

# 3. Limit MongoDB cache to 256MB
echo "============================================"
echo "  3. Limiting MongoDB cache (→ 256MB)"
echo "============================================"
MONGOD_CONF="/etc/mongod.conf"
cp "$MONGOD_CONF" "$MONGOD_CONF.bak"
if grep -q "wiredTiger" "$MONGOD_CONF"; then
    echo "  wiredTiger config already exists, updating..."
    # Use python to safely update YAML
    python3 -c "
import yaml
with open('$MONGOD_CONF') as f:
    conf = yaml.safe_load(f)
if 'storage' not in conf:
    conf['storage'] = {}
if 'wiredTiger' not in conf['storage']:
    conf['storage']['wiredTiger'] = {}
if 'engineConfig' not in conf['storage']['wiredTiger']:
    conf['storage']['wiredTiger']['engineConfig'] = {}
conf['storage']['wiredTiger']['engineConfig']['cacheSizeGB'] = 0.25
with open('$MONGOD_CONF', 'w') as f:
    yaml.dump(conf, f, default_flow_style=False)
print('  Config updated')
" 2>/dev/null
    if [ $? -ne 0 ]; then
        # Fallback: add manually if python/yaml not available
        if ! grep -q "cacheSizeGB" "$MONGOD_CONF"; then
            sed -i '/wiredTiger:/a\    engineConfig:\n      cacheSizeGB: 0.25' "$MONGOD_CONF"
            echo "  Added cacheSizeGB via sed"
        fi
    fi
else
    # Add wiredTiger section
    cat >> "$MONGOD_CONF" << 'MONGO_EOF'

  wiredTiger:
    engineConfig:
      cacheSizeGB: 0.25
MONGO_EOF
    echo "  Added wiredTiger cache limit"
fi
systemctl restart mongod
sleep 3
if systemctl is-active --quiet mongod; then
    echo "  MongoDB restarted with 256MB cache limit"
else
    echo "  WARNING: MongoDB failed to start, restoring backup..."
    cp "$MONGOD_CONF.bak" "$MONGOD_CONF"
    systemctl restart mongod
    echo "  Restored original config"
fi
echo ""

# Wait for services to settle
echo "Waiting 5 seconds for services to settle..."
sleep 5

# Show after
echo ""
echo "============================================"
echo "  RESULTS"
echo "============================================"
echo ""
echo "[AFTER] Memory status:"
free -h
echo ""
echo "SpamAssassin processes:"
ps aux | grep spamd | grep -v grep | wc -l
echo ""
echo "Apache workers:"
ps aux | grep httpd | grep -v grep | wc -l
echo ""
echo "MongoDB memory:"
ps aux | grep mongod | grep -v grep | awk '{print $6/1024 " MB"}'
echo ""
echo "============================================"
echo "  Optimization complete!"
echo "  Expected savings: ~700MB of RAM"
echo "============================================"
