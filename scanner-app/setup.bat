@echo off
title FlipSlab Scanner - Setup
color 0B

echo.
echo  ============================================
echo   FlipSlab Scanner - Instalador
echo  ============================================
echo.

:: Test if Python ACTUALLY works (not the Windows Store alias)
python --version >nul 2>&1
if %errorlevel% neq 0 goto INSTALL_PYTHON

python -c "print('ok')" >nul 2>&1
if %errorlevel% neq 0 goto INSTALL_PYTHON

goto PYTHON_OK

:INSTALL_PYTHON
echo  [!] Python no esta instalado (o es el alias de Microsoft Store).
echo.
echo  Descargando Python 3.12 automaticamente...
echo.

powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe' -OutFile '%TEMP%\python_setup.exe'; Write-Host '  Descarga completa.'"

if not exist "%TEMP%\python_setup.exe" (
    echo.
    echo  [ERROR] No se pudo descargar. Instala Python manualmente:
    echo  https://www.python.org/downloads/
    echo  MARCA: "Add Python to PATH"
    start https://www.python.org/downloads/
    pause
    exit /b 1
)

echo.
echo  Instalando Python (tarda 1-2 min, no cierres esta ventana)...
"%TEMP%\python_setup.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_launcher=1

:: Wait for install to finish
timeout /t 10 /nobreak >nul

:: Refresh PATH for this session
set "PYTHON_DIR=%LOCALAPPDATA%\Programs\Python\Python312"
set "PATH=%PYTHON_DIR%;%PYTHON_DIR%\Scripts;%PATH%"

:: Verify
"%PYTHON_DIR%\python.exe" --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] La instalacion automatica fallo.
    echo  Instala Python manualmente:
    echo  1. Ve a https://www.python.org/downloads/
    echo  2. Descarga Python 3.12
    echo  3. Al instalar MARCA: "Add Python to PATH"  
    echo  4. Reinicia tu PC
    echo  5. Corre este setup.bat de nuevo
    start https://www.python.org/downloads/
    pause
    exit /b 1
)

set "PY=%PYTHON_DIR%\python.exe"
echo  [OK] Python instalado!
goto DO_SETUP

:PYTHON_OK
set "PY=python"
echo  [OK] Python encontrado:
python --version

:DO_SETUP
echo.

:: Install dependencies
echo  [*] Instalando dependencias...
echo     (pytwain, Pillow, requests - tarda 1-2 min)
echo.
%PY% -m pip install --upgrade pip >nul 2>&1
%PY% -m pip install pytwain Pillow requests

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Fallo instalando dependencias.
    pause
    exit /b 1
)

echo.
echo  [OK] Dependencias instaladas.
echo.

:: Create app folder
set "APP_DIR=%USERPROFILE%\FlipSlabScanner"
if not exist "%APP_DIR%" mkdir "%APP_DIR%"
copy /Y "%~dp0scanner.py" "%APP_DIR%\scanner.py" >nul
echo  [OK] App copiada a: %APP_DIR%

:: Create launcher
(
echo @echo off
echo title FlipSlab Scanner
echo cd /d "%APP_DIR%"
echo %PY% scanner.py
echo if %%errorlevel%% neq 0 pause
) > "%APP_DIR%\Launch.bat"

:: Desktop shortcut
set "DESKTOP=%USERPROFILE%\Desktop"
powershell -ExecutionPolicy Bypass -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%DESKTOP%\FlipSlab Scanner.lnk'); $s.TargetPath = '%APP_DIR%\Launch.bat'; $s.WorkingDirectory = '%APP_DIR%'; $s.Description = 'FlipSlab Card Scanner'; $s.Save()"

if exist "%DESKTOP%\FlipSlab Scanner.lnk" (
    echo  [OK] Shortcut creado en Desktop!
) else (
    echo  [!] No se creo shortcut. Abre manualmente: %APP_DIR%\Launch.bat
)

echo.
echo  ============================================
echo   LISTO! Instalacion completa.
echo.
echo   Haz doble click en "FlipSlab Scanner" 
echo   en tu escritorio para abrir la app.
echo  ============================================
echo.
set /p OPEN="  Abrir la app ahora? (S/N): "
if /i "%OPEN%"=="S" (
    cd /d "%APP_DIR%"
    start "" %PY% scanner.py
)

pause
