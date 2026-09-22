@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo === TestCase Maker : local launcher ===
echo.

where python >nul 2>&1 || (echo Python not found on PATH. Install Python 3.11+ and try again. & pause & exit /b 1)
where npm >nul 2>&1 || (echo npm not found on PATH. Install Node.js 20+ and try again. & pause & exit /b 1)

if not exist backend\.venv (
    echo [1/4] Creating backend virtual environment...
    python -m venv backend\.venv || goto :err
)

echo [2/4] Installing backend dependencies...
backend\.venv\Scripts\python.exe -m pip install -q --upgrade pip
backend\.venv\Scripts\python.exe -m pip install -q -r backend\requirements.txt || goto :err

if not exist backend\.env (
    copy backend\.env.example backend\.env >nul
    echo Created backend\.env from the example. Edit it and add your ANTHROPIC_API_KEY for
    echo real generation, or leave it as is to run in demo mode with canned output.
    echo.
)

set HAVE_KEY=0
for /f "delims=" %%K in ('backend\.venv\Scripts\python.exe -c "import re,pathlib; t=pathlib.Path('backend/.env').read_text(encoding='utf-8'); m=re.search(r'^ANTHROPIC_API_KEY=(\S+)', t, re.M); print('1' if m and m.group(1) not in ('', 'sk-ant-...') else '0')"') do set HAVE_KEY=%%K

if "!HAVE_KEY!"=="1" (
    echo [3/4] Starting backend on http://127.0.0.1:8010  ^(real Claude API^)
    start "TestCase Maker - backend" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8010"
) else (
    echo [3/4] Starting backend on http://127.0.0.1:8010  ^(DEMO MODE - no API key in backend\.env, using canned output^)
    start "TestCase Maker - backend" cmd /k "cd /d "%~dp0backend" && set TESTCASE_MAKER_MOCK=1 && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8010"
)

if not exist frontend\node_modules (
    echo Installing frontend dependencies, this only happens once...
    pushd frontend
    call npm install
    popd
    if errorlevel 1 goto :err
)

echo [4/4] Starting frontend on http://127.0.0.1:5173
start "TestCase Maker - frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"

echo.
echo Waiting for the app to come up...
timeout /t 5 /nobreak >nul
start "" "http://127.0.0.1:5173"

echo.
echo Two windows opened: backend and frontend. Closing either one stops it,
echo or run stop.bat to stop both. This window can be closed.
pause
exit /b 0

:err
echo.
echo Setup failed. Read the message above and try again.
pause
exit /b 1
