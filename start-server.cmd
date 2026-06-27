@echo off
title FeedFlow ERP Server
cd /d "D:\tag_erp"

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

set DATABASE_URL=postgres://postgres:123@localhost:5432/elnujoom
set PORT=8080
set NODE_ENV=production

echo ============================================
echo    FeedFlow ERP
echo ============================================
echo.
echo  Local access:   http://localhost:8080
echo  Same WiFi:      http://%LOCAL_IP%:8080
echo.
echo  To access from ANYWHERE ^(internet^):
echo    Open NEW terminal ^& run: tunnel.cmd
echo    ^(requires port 8080 running^)
echo.
echo  Close this window to stop.
echo ============================================
echo.

cd /d "D:\tag_erp\artifacts\api-server"
node --enable-source-maps ".\dist\index.mjs"

pause
