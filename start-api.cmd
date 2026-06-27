@echo off
set DATABASE_URL=postgres://postgres:123@localhost:5432/elnujoom
set PORT=8080
set NODE_ENV=development
cd /d "D:\tag_erp\artifacts\api-server"
start "API-Server" /MIN node --enable-source-maps ".\dist\index.mjs"
