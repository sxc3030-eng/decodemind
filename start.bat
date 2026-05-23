@echo off
REM Double-click to start the DecodeMind spike dev server.
REM Opens the browser automatically (server.open is set in vite.config.ts).
cd /d %~dp0
npm run dev
