@echo off
title FlipSlab Scanner - Setup
color 0B

echo.
echo  ============================================
echo   FlipSlab Scanner - Instalador
echo  ============================================
echo.

:: Check if Python is installed
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Python NO esta instalado en tu PC.
    echo.
    echo  Necesitas instalar Python primero:
    echo  1. Ve a: https://www.python.org/downloads/
    echo  2. Descarga e instala Python
    echo  3. MUY IMPORTANTE: Marca "Add Python to PATH"
    echo  4. Despues corre este setup.bat de nuevo
    echo.
    start https://www.python.org/downloads/
    pause
    exit /b 1
)

echo  [OK] Python encontrado:
python --version
echo.

:: Install dependencies
echo  [*] Instalando dependencias (pytwain, Pillow, requests)...
echo     Esto puede tardar 1-2 minutos...
python -m pip install --upgrade pip >nul 2>&1
python -m pip install pytwain Pillow requests
echo.

if %errorlevel% neq 0 (
    echo  [ERROR] Fallo instalando dependencias.
    echo  Intenta correr esto manualmente:
    echo  python -m pip install pytwain Pillow requests
    pause
    exit /b 1
)

echo  [OK] Dependencias instaladas.
echo.

:: Create app folder
set "APP_DIR=%USERPROFILE%\FlipSlabScanner"
echo  [*] Creando carpeta: %APP_DIR%
if not exist "%APP_DIR%" mkdir "%APP_DIR%"

:: Copy scanner.py to app folder
copy /Y "%~dp0scanner.py" "%APP_DIR%\scanner.py" >nul
echo  [OK] scanner.py copiado.

:: Create launcher bat
echo @echo off > "%APP_DIR%\Launch.bat"
echo title FlipSlab Scanner >> "%APP_DIR%\Launch.bat"
echo cd /d "%APP_DIR%" >> "%APP_DIR%\Launch.bat"
echo python scanner.py >> "%APP_DIR%\Launch.bat"
echo if %%errorlevel%% neq 0 pause >> "%APP_DIR%\Launch.bat"

echo  [OK] Launcher creado.

:: Create desktop shortcut using PowerShell
set "DESKTOP=%USERPROFILE%\Desktop"
echo  [*] Creando shortcut en: %DESKTOP%

powershell -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%DESKTOP%\FlipSlab Scanner.lnk'); $s.TargetPath = '%APP_DIR%\Launch.bat'; $s.WorkingDirectory = '%APP_DIR%'; $s.Description = 'FlipSlab Card Scanner'; $s.Save(); Write-Host '  [OK] Shortcut creado!'"

if not exist "%DESKTOP%\FlipSlab Scanner.lnk" (
    echo.
    echo  [!] No se pudo crear el shortcut automaticamente.
    echo  [!] Pero la app esta instalada. Para abrirla:
    echo      1. Abre la carpeta: %APP_DIR%
    echo      2. Doble click en Launch.bat
    echo.
    explorer "%APP_DIR%"
)

echo.
echo  ============================================
echo   INSTALACION COMPLETA!
echo.
echo   Para abrir FlipSlab Scanner:
echo   - Doble click "FlipSlab Scanner" en tu Desktop
echo   - O abre: %APP_DIR%\Launch.bat
echo  ============================================
echo.
echo  Quieres abrir la app ahora? (S/N)
set /p OPEN="> "
if /i "%OPEN%"=="S" (
    cd /d "%APP_DIR%"
    start "" python scanner.py
)

pause
