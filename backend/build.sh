#!/bin/bash
set -e
pip install -r requirements.txt
cd ../frontend
npm install --cache /tmp/npm-cache --legacy-peer-deps
npm run build
echo "Build complete"
