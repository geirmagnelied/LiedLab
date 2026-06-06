@echo off
title Notatapp
cd /d "%~dp0"

:: Sjekk om node_modules finst
if not exist "node_modules\" (
  echo Installerer avhengigheiter, ver tolmodig...
  npm install
  if errorlevel 1 (
    echo.
    echo npm install feila. Prover med --legacy-peer-deps...
    npm install --legacy-peer-deps
  )
  echo Byggjer appen...
  npm run build
)

:: Sjekk om dist finst
if not exist "dist\" (
  echo Byggjer appen...
  npm run build
)

:: Start Electron
echo Startar Notatapp...
npm run electron
