#!/bin/bash
cd /home/gradeprophet && git pull
cp -r /home/gradeprophet/frontend/src/* /opt/gradeprophet/frontend/src/
cd /opt/gradeprophet/frontend && npm run build --legacy-peer-deps
cp -r /opt/gradeprophet/frontend/build/* /home/flipcardsuni2/public_html/
echo "LISTO!"
