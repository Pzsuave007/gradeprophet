#!/bin/bash
cd /home/gradeprophet
git fetch origin
git checkout origin/update2-23 -- .
cp -r backend/* /opt/gradeprophet/backend/
cp -r frontend/* /opt/gradeprophet/frontend/
cd /opt/gradeprophet/frontend
yarn build
sudo systemctl restart gradeprophet-backend
sudo systemctl restart gradeprophet-frontend
echo "LISTO"
