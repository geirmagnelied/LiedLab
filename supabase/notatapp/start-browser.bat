@echo off
title Notatapp (nettlesar)
cd /d "%~dp0"
start "" http://localhost:5173
npm run dev
