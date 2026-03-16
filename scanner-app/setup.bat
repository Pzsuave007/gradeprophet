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
set "TWAIN_DLL_APP=%APP_DIR%\TWAINDSM.DLL"
set "TWAIN_DLL_SYS=%SYSTEMROOT%\System32\TWAINDSM.DLL"

if exist "%TWAIN_DLL_SYS%" (
    echo  [OK] TWAIN DSM ya esta en System32.
    goto TWAIN_DONE
)
if exist "%TWAIN_DLL_APP%" (
    echo  [OK] TWAIN DSM ya esta en la carpeta de la app.
    goto TWAIN_DONE
)

echo  [*] Descargando TWAIN DSM...
set "TWAIN_MSI=%TEMP%\twaindsm.msi"
set "TWAIN_EXTRACT=%TEMP%\twain_extract"

powershell -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri 'https://github.com/twain/twain-dsm/releases/download/v2.5.1/TWAINDSM_2.5.1.msi' -OutFile '%TWAIN_MSI%'; Write-Host '  Descarga completa.' } catch { Write-Host '  [!] Error descargando' }"

if not exist "%TWAIN_MSI%" (
    echo  [!] No se pudo descargar TWAIN DSM.
    echo  [!] Descarga manualmente desde: https://github.com/twain/twain-dsm/releases
    echo  [!] Copia TWAINDSM.DLL a: %APP_DIR%
    goto TWAIN_DONE
)

:: Extract DLL from MSI to temp folder
echo  [*] Extrayendo TWAINDSM.DLL...
if exist "%TWAIN_EXTRACT%" rmdir /s /q "%TWAIN_EXTRACT%"
mkdir "%TWAIN_EXTRACT%" 2>nul
msiexec /a "%TWAIN_MSI%" /qn TARGETDIR="%TWAIN_EXTRACT%" >nul 2>&1
timeout /t 3 /nobreak >nul

:: Find and copy the DLL
for /r "%TWAIN_EXTRACT%" %%f in (TWAINDSM.DLL twaindsm.dll) do (
    if exist "%%f" (
        copy /Y "%%f" "%APP_DIR%\TWAINDSM.DLL" >nul
        echo  [OK] TWAINDSM.DLL copiado a la carpeta de la app!
        goto TWAIN_CLEANUP
    )
)

:: If extraction failed, try direct MSI install (needs admin)
echo  [*] Intentando instalar MSI (puede pedir permisos de admin)...
msiexec /i "%TWAIN_MSI%" /quiet /norestart >nul 2>&1
timeout /t 3 /nobreak >nul
if exist "%TWAIN_DLL_SYS%" (
    echo  [OK] TWAIN DSM instalado en System32!
) else (
    echo  [!] No se pudo instalar automaticamente.
    echo  [!] Instala manualmente: %TWAIN_MSI%
    echo  [!] O copia TWAINDSM.DLL a: %APP_DIR%
)

:TWAIN_CLEANUP
if exist "%TWAIN_EXTRACT%" rmdir /s /q "%TWAIN_EXTRACT%" 2>nul
del "%TWAIN_MSI%" 2>nul

:TWAIN_DONE
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
