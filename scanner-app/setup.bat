@echo off
title FlipSlab Scanner - Setup
color 0B

echo.
echo  ============================================
echo   FlipSlab Scanner - Instalador
echo  ============================================
echo.

:: Test if Python ACTUALLY works
python -c "print('ok')" >nul 2>&1
if %errorlevel% neq 0 goto INSTALL_PYTHON
goto PYTHON_OK

:INSTALL_PYTHON
echo  [!] Python no esta instalado.
echo  [*] Descargando Python 3.12...
echo.

powershell -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe' -OutFile '%TEMP%\python_setup.exe'; Write-Host '  Descarga completa.'"

if not exist "%TEMP%\python_setup.exe" (
    echo  [ERROR] No se pudo descargar Python.
    echo  Descargalo manualmente: https://www.python.org/downloads/
    echo  MARCA: "Add Python to PATH"
    start https://www.python.org/downloads/
    pause
    exit /b 1
)

echo  [*] Instalando Python (tarda 1-2 min)...
"%TEMP%\python_setup.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_pip=1 Include_launcher=1
timeout /t 10 /nobreak >nul

set "PYTHON_DIR=%LOCALAPPDATA%\Programs\Python\Python312"
set "PATH=%PYTHON_DIR%;%PYTHON_DIR%\Scripts;%PATH%"

"%PYTHON_DIR%\python.exe" -c "print('ok')" >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Instala Python manualmente:
    echo  https://www.python.org/downloads/
    echo  MARCA: "Add Python to PATH" y reinicia tu PC
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
%PY% --version

:DO_SETUP
echo.
echo  [*] Instalando dependencias...
%PY% -m pip install --upgrade pip >nul 2>&1
%PY% -m pip install Pillow requests pywin32 numpy pytwain

if %errorlevel% neq 0 (
    echo  [ERROR] Fallo instalando dependencias.
    pause
    exit /b 1
)

echo.
echo  [OK] Dependencias instaladas.
echo.

:: Install TWAIN DSM (required for duplex scanning)
echo  [*] Instalando TWAIN DSM para duplex scanning...
set "TWAIN_DLL=%SYSTEMROOT%\System32\TWAINDSM.DLL"
if not exist "%TWAIN_DLL%" (
    powershell -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://github.com/twain/twain-dsm/releases/download/v2.5.1/TWAINDSM_2.5.1.msi' -OutFile '%TEMP%\twaindsm.msi'; Write-Host '  TWAIN DSM descargado.' } catch { Write-Host '  [!] No se pudo descargar TWAIN DSM' }"
    if exist "%TEMP%\twaindsm.msi" (
        echo  [*] Instalando TWAIN DSM...
        msiexec /i "%TEMP%\twaindsm.msi" /quiet /norestart
        timeout /t 3 /nobreak >nul
        if exist "%TWAIN_DLL%" (
            echo  [OK] TWAIN DSM instalado!
        ) else (
            echo  [!] TWAIN DSM no se instalo automaticamente.
            echo  [!] Instala manualmente: %TEMP%\twaindsm.msi
        )
    ) else (
        echo  [!] No se pudo descargar TWAIN DSM.
        echo  [!] Descarga manualmente: https://github.com/twain/twain-dsm/releases
    )
) else (
    echo  [OK] TWAIN DSM ya esta instalado.
)
echo.

:: Setup app folder
set "APP_DIR=%USERPROFILE%\FlipSlabScanner"
if not exist "%APP_DIR%" mkdir "%APP_DIR%"
copy /Y "%~dp0scanner.py" "%APP_DIR%\scanner.py" >nul

:: Create launcher (pythonw = no console window)
(
echo @echo off
echo cd /d "%APP_DIR%"
echo start "" %PY%w scanner.py
) > "%APP_DIR%\Launch.bat"

:: Desktop shortcut
set "DESKTOP=%USERPROFILE%\Desktop"
powershell -ExecutionPolicy Bypass -Command "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%DESKTOP%\FlipSlab Scanner.lnk'); $s.TargetPath = '%APP_DIR%\Launch.bat'; $s.WorkingDirectory = '%APP_DIR%'; $s.Description = 'FlipSlab Card Scanner'; $s.Save()"

if exist "%DESKTOP%\FlipSlab Scanner.lnk" (
    echo  [OK] Shortcut creado en Desktop!
) else (
    echo  [!] Abre manualmente: %APP_DIR%\Launch.bat
)

echo.
echo  ============================================
echo   LISTO!
echo   Doble click "FlipSlab Scanner" en tu Desktop
echo  ============================================
echo.
set /p OPEN="  Abrir la app ahora? (S/N): "
if /i "%OPEN%"=="S" (
    cd /d "%APP_DIR%"
    start "" %PY% scanner.py
)

pause
