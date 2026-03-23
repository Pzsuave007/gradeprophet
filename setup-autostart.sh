#!/bin/bash
echo "Installing auto-restart for FlipSlab Backend..."
(crontab -l 2>/dev/null | grep -v "restart.sh"; echo "@reboot /bin/bash /home/gradeprophet/restart.sh") | crontab -
echo "Done! Backend will auto-start on every server reboot."
echo "Verify:"
crontab -l | grep restart
