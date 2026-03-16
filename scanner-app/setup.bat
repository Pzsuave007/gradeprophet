@echo off
title FlipSlab Scanner - Setup
color 0B

echo.
echo  ============================================
echo   FlipSlab Scanner - Instalador Automatico
echo  ============================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Python no esta instalado.
    echo  [!] Descargando Python...
    echo.
    
    :: Download Python installer
    powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe' -OutFile '%TEMP%\python_installer.exe'"
    
    if not exist "%TEMP%\python_installer.exe" (
        echo  [ERROR] No se pudo descargar Python.
        echo  Por favor descarga Python manualmente desde: https://www.python.org/downloads/
        echo  IMPORTANTE: Marca la casilla "Add Python to PATH" al instalar.
        pause
        exit /b 1
    )
    
    echo  [*] Instalando Python (esto tarda 1-2 minutos)...
    "%TEMP%\python_installer.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1
    
    :: Refresh PATH
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"
    
    echo  [OK] Python instalado.
    echo.
)

echo  [1/3] Python detectado:
python --version
echo.

:: Install dependencies
echo  [2/3] Instalando dependencias...
pip install pytwain Pillow requests >nul 2>&1
if %errorlevel% neq 0 (
    python -m pip install pytwain Pillow requests
)
echo  [OK] Dependencias instaladas.
echo.

:: Create app folder
set "APP_DIR=%USERPROFILE%\FlipSlab Scanner"
if not exist "%APP_DIR%" mkdir "%APP_DIR%"

:: Copy scanner.py
copy /Y "%~dp0scanner.py" "%APP_DIR%\scanner.py" >nul

:: Create launcher bat
(
echo @echo off
echo title FlipSlab Scanner
echo cd /d "%APP_DIR%"
echo python scanner.py
echo if %%errorlevel%% neq 0 pause
) > "%APP_DIR%\FlipSlabScanner.bat"

:: Create desktop shortcut
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\FlipSlab Scanner.lnk'); $s.TargetPath = '%APP_DIR%\FlipSlabScanner.bat'; $s.WorkingDirectory = '%APP_DIR%'; $s.Description = 'FlipSlab Card Scanner'; $s.Save()"

echo  [3/3] Shortcut creado en tu Desktop.
echo.
echo  ============================================
echo   LISTO! 
echo   Haz doble click en "FlipSlab Scanner" 
echo   en tu escritorio para abrir la app.
echo  ============================================
echo.
echo  Abriendo FlipSlab Scanner...
echo.

:: Launch the app
cd /d "%APP_DIR%"
start "" python scanner.py

timeout /t 5 >nul
