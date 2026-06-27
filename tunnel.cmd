@echo off
title FeedFlow ERP - Tunnel
cd /d "D:\tag_erp"

set "TOOL_DIR=D:\tag_erp\.tools"
set "CLOUDFLARED=%TOOL_DIR%\cloudflared.exe"

if not exist "%CLOUDFLARED%" (
  echo Downloading Cloudflare Tunnel client...
  if not exist "%TOOL_DIR%" mkdir "%TOOL_DIR%"
  curl -sL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -o "%CLOUDFLARED%"
  if %errorlevel% neq 0 (
    echo Failed to download. Try again or install manually from:
    echo   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo   Creating public tunnel to your server...
echo ============================================
echo.
echo  Make sure the server is running first:
echo    D:\tag_erp\start-server.cmd
echo.
echo  ^(Keep this window open^)
echo.
echo ============================================
echo  Public URL will appear below (copy it):
echo ============================================
echo.

"%CLOUDFLARED%" tunnel --url http://localhost:8080

pause
