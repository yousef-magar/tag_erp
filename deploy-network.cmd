@echo off
title FeedFlow ERP - Network Deployment
cd /d "D:\tag_erp"

:: Check prerequisites
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Error: Node.js is not installed!
  pause
  exit /b 1
)

:: Detect local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "^[ ]*IPv4.*192\.168\.\|^[ ]*IPv4.*10\.\|^[ ]*IPv4.*172\."') do (
  for %%b in (%%a) do set "LOCAL_IP=%%b"
)
if not defined LOCAL_IP (
  for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "^[ ]*IPv4"') do (
    for %%b in (%%a) do set "LOCAL_IP=%%b"
    if defined LOCAL_IP goto :ipfound
  )
)
:ipfound
if not defined LOCAL_IP set LOCAL_IP=127.0.0.1

echo ============================================
echo    FeedFlow ERP - Network Deployment
echo ============================================
echo.
echo  Local IP: %LOCAL_IP%
echo.
echo  ^> Building frontend...
cd /d "D:\tag_erp\artifacts\feedflow-erp"
set BASE_PATH=/
set PORT=3000
call npx vite build --config vite.config.ts 2>&1
if %errorlevel% neq 0 (
  echo Frontend build failed!
  pause
  exit /b 1
)

echo.
echo  ^> Building API server...
cd /d "D:\tag_erp\artifacts\api-server"
call node build.mjs 2>&1
if %errorlevel% neq 0 (
  echo API server build failed!
  pause
  exit /b 1
)

echo.
echo  ^> Starting server on port 8080...
set DATABASE_URL=postgres://postgres:123@localhost:5432/elnujoom
set PORT=8080
set NODE_ENV=production

echo.
echo ============================================
echo    SYSTEM IS RUNNING!
echo ============================================
echo.
echo  Access from THIS computer:
echo    http://localhost:8080
echo.
echo  Access from other devices (same WiFi):
echo    http://%LOCAL_IP%:8080
echo.
echo  To install as app:
echo    Open the URL in Chrome/Edge on any device
echo    Click Install (install icon in address bar)
echo    It will appear as a standalone app!
echo.
echo ============================================
echo  Close this window to stop the server.
echo ============================================
echo.

node --enable-source-maps ".\dist\index.mjs"

pause
