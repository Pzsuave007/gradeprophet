#!/bin/bash
echo "============================================"
echo "  FlipSlab Server Fix - Swap Setup"
echo "============================================"

# 1. Create 2GB swap file
echo ""
echo "[1/5] Creating 2GB swap file..."
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile

# 2. Set up swap
echo "[2/5] Configuring swap..."
sudo mkswap /swapfile
sudo swapon /swapfile

# 3. Make permanent (survive reboots)
echo "[3/5] Making swap permanent..."
if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "  Added to /etc/fstab"
else
    echo "  Already in /etc/fstab, skipping"
fi

# 4. Optimize swap usage (don't swap unless really needed)
echo "[4/5] Optimizing swap settings..."
sudo sysctl vm.swappiness=10
if ! grep -q 'vm.swappiness' /etc/sysctl.conf; then
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
fi

# 5. Show results
echo "[5/5] Done! Verifying..."
echo ""
echo "============================================"
echo "  MEMORY STATUS"
echo "============================================"
free -h
echo ""
echo "============================================"
echo "  TOP MEMORY PROCESSES"
echo "============================================"
ps aux --sort=-%mem | head -15
echo ""
echo "============================================"
echo "  Swap setup complete!"
echo "  Your server should stop crashing now."
echo "============================================"
