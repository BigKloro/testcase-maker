@echo off
echo Stopping TestCase Maker (ports 8010 and 5173)...
setlocal enabledelayedexpansion
set FOUND=0
for %%P in (8010 5173) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
        echo   stopping process on port %%P (pid %%A^)
        taskkill /PID %%A /F >nul 2>&1
        set FOUND=1
    )
)
if "!FOUND!"=="0" echo   nothing was running.
echo Done.
pause
