@echo off
setlocal
title GiRED Fixer - Instalacao

echo ==========================================
echo   GiRED Fixer - Instalacao
echo ==========================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0updater\windows\install-updater.ps1"

if errorlevel 1 (
    echo.
    echo A instalacao encontrou um erro.
    pause
    exit /b 1
)

echo.
echo Configuracao concluida.
echo Na pagina de extensoes, ativa o Modo de programador e seleciona esta pasta em "Carregar sem compactacao".
echo.
pause
