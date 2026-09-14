#!/usr/bin/env bash
# First deploy and every update. Run on the VPS as the deploy user, from anywhere:
#   /var/www/testcase-maker/deploy/deploy.sh
# Prereqs (once): git clone to /var/www/testcase-maker, python3 + python3-venv, node 20+, pm2, backend/.env with ANTHROPIC_API_KEY,
#                 nginx site from deploy/nginx.testcase-maker.conf.
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
python3 -m venv backend/.venv
backend/.venv/bin/pip install -q --upgrade pip
backend/.venv/bin/pip install -q -r backend/requirements.txt
backend/.venv/bin/python backend/tests/test_pipeline.py
( cd frontend && npm ci --no-audit --no-fund && npm run build )
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
curl -fsS http://127.0.0.1:8010/api/v1/health && echo
