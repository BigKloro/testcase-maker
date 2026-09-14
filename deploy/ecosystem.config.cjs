// PM2 process file. On the VPS, from the repo root:  pm2 startOrReload deploy/ecosystem.config.cjs && pm2 save
// The API reads backend/.env (ANTHROPIC_API_KEY, TESTCASE_MAKER_MODEL, TESTCASE_MAKER_EFFORT) itself via python-dotenv.
const path = require("path");

module.exports = {
  apps: [
    {
      name: "testcase-maker-api",
      cwd: path.join(__dirname, "..", "backend"),
      script: ".venv/bin/uvicorn",
      args: "app.main:app --host 127.0.0.1 --port 8010 --workers 2 --timeout-keep-alive 75",
      interpreter: "none",
      env: { PYTHONUNBUFFERED: "1" },
      autorestart: true,
      max_memory_restart: "500M",
      time: true,
    },
  ],
};
