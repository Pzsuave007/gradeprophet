# FlipSlab Scanner Companion

Desktop app para escanear sports cards con **cualquier scanner TWAIN** y subirlas automáticamente a FlipSlab Engine. La AI identifica cada card.

## Requisitos
- Windows 10/11
- Python 3.10+ instalado ([python.org](https://www.python.org/downloads/))
- Tu scanner con drivers instalados

## Instalación

1. Descarga la carpeta `scanner-app` a tu PC

2. Abre CMD o PowerShell en la carpeta y corre:
```
pip install pytwain Pillow requests
```

3. Corre la app:
```
python scanner.py
```

## Cómo usar

1. **Connect** - Ingresa tu email y password de FlipSlab
2. **Detect Scanners** - Detecta todos los scanners instalados
3. **Select** - Elige tu scanner
4. **SCAN CARD** - Escanea una tarjeta (preview a la derecha)
5. **Upload to FlipSlab** - Sube todas las cards escaneadas a tu inventario
   - La AI identifica automáticamente: jugador, año, set, número

## Opciones adicionales
- **Import from folder** - Si ya tienes imágenes escaneadas, importa desde una carpeta
- **Clear All** - Limpia la cola de escaneo

## Build .exe (opcional, para no necesitar Python)
```
pip install pyinstaller
pyinstaller --onefile --windowed --name FlipSlabScanner scanner.py
```
El .exe estará en `dist/FlipSlabScanner.exe`

## Scanners probados
- Fujitsu fi-6130Z
- Cualquier scanner con drivers TWAIN (Epson, Canon, HP, Brother, etc.)
