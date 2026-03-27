#!/bin/bash
echo "============================================"
echo "  FlipSlab - Memory Health Check"
echo "============================================"
echo ""

# RAM
TOTAL=$(free -m | awk '/Mem:/{print $2}')
USED=$(free -m | awk '/Mem:/{print $3}')
AVAIL=$(free -m | awk '/Mem:/{print $7}')
PCT=$((USED * 100 / TOTAL))

echo "RAM: ${USED}MB / ${TOTAL}MB (${PCT}% usado) | Disponible: ${AVAIL}MB"

if [ $PCT -gt 90 ]; then
    echo "  CRITICO - RAM casi llena"
elif [ $PCT -gt 75 ]; then
    echo "  ALERTA - RAM alta, monitorear"
else
    echo "  OK"
fi

echo ""

# Swap
SWAP_TOTAL=$(free -m | awk '/Swap:/{print $2}')
SWAP_USED=$(free -m | awk '/Swap:/{print $3}')
if [ $SWAP_TOTAL -gt 0 ]; then
    SWAP_PCT=$((SWAP_USED * 100 / SWAP_TOTAL))
    echo "SWAP: ${SWAP_USED}MB / ${SWAP_TOTAL}MB (${SWAP_PCT}% usado)"
    if [ $SWAP_PCT -gt 70 ]; then
        echo "  ALERTA - Swap alto, servidor bajo presion"
    else
        echo "  OK"
    fi
else
    echo "SWAP: No configurado"
fi

echo ""

# Top 5 procesos
echo "Top 5 procesos por RAM:"
echo "----------------------------------------"
ps aux --sort=-%mem | head -6 | awk 'NR==1{printf "%-10s %6s %s\n","USER","MEM%","COMMAND"} NR>1{printf "%-10s %5.1f%% %s\n",$1,$4,$11}'

echo ""

# Servicios clave
echo "Servicios:"
for SVC in httpd mongod mysqld spamd node; do
    MEM=$(ps aux | grep "$SVC" | grep -v grep | awk '{sum+=$6} END {printf "%.0f", sum/1024}')
    if [ "$MEM" -gt 0 ] 2>/dev/null; then
        echo "  $SVC: ${MEM}MB"
    fi
done

echo ""
echo "============================================"
