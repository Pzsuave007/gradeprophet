#!/bin/bash
cd /home/gradeprophet && git pull
cp -r frontend/src /opt/gradeprophet/frontend/src
cd /opt/gradeprophet/frontend && npm run build --legacy-peer-deps
echo "LISTO!"
