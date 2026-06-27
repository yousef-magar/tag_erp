@echo off
title FeedFlow ERP - Online Mode

:: Start server in a new window
start "FeedFlow Server" cmd /c "D:\tag_erp\start-server.cmd"

:: Wait for server to start
timeout /t 4 /nobreak >nul

:: Start tunnel in a new window
start "FeedFlow Tunnel" cmd /c "D:\tag_erp\tunnel.cmd"

echo.
echo ============================================
echo   Both windows opened!
echo.
echo   1. Wait for tunnel URL to appear
echo   2. Copy the https://xxxxx.trycloudflare.com link
echo   3. Share it with anyone, anywhere
echo.
echo   Close all windows to stop.
echo ============================================
echo.
pause
