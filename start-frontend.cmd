@echo off
set NODE_ENV=development
set PORT=3000
set BASE_PATH=/
cd /d "D:\tag_erp"
start "Frontend" /MIN "C:\Users\usfmg\AppData\Roaming\npm\pnpm.cmd" --filter @workspace/feedflow-erp run dev
